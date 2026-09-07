from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Any, Dict, Optional
from supabase import Client
from app.core.supabase import get_supabase_client
import pandas as pd
import math

try:
    from scipy import stats
except ImportError:
    pass

router = APIRouter()

class StatsRequest(BaseModel):
    test_type: str # T_TEST_IND, T_TEST_PAIRED, ANOVA, PEARSON, SPEARMAN, CHI_SQUARE
    variable_a: str
    variable_b: Optional[str] = None
    group_by: Optional[str] = None

def get_interpretation(p_value: float, test_type: str, var_a: str, var_b: str = "", group_by: str = "") -> str:
    sig = p_value < 0.05
    
    if test_type in ["T_TEST_IND", "ANOVA"]:
        if sig:
            return f"Statistically significant difference found in '{var_a}' across different groups of '{group_by}'. (Reject Null Hypothesis)"
        else:
            return f"No statistically significant difference found in '{var_a}' across different groups of '{group_by}'. (Fail to reject Null Hypothesis)"
            
    if test_type == "T_TEST_PAIRED":
        if sig:
            return f"Statistically significant difference found between '{var_a}' and '{var_b}'. (Reject Null Hypothesis)"
        else:
            return f"No statistically significant difference found between '{var_a}' and '{var_b}'. (Fail to reject Null Hypothesis)"
            
    if test_type in ["PEARSON", "SPEARMAN"]:
        if sig:
            return f"Statistically significant correlation found between '{var_a}' and '{var_b}'. (Reject Null Hypothesis)"
        else:
            return f"No statistically significant correlation found between '{var_a}' and '{var_b}'. (Fail to reject Null Hypothesis)"
            
    if test_type == "CHI_SQUARE":
        if sig:
            return f"Statistically significant association found between '{var_a}' and '{var_b}'. Variables are dependent. (Reject Null Hypothesis)"
        else:
            return f"No statistically significant association found between '{var_a}' and '{var_b}'. Variables are independent. (Fail to reject Null Hypothesis)"
            
    return "Test completed."

@router.post("/{dataset_id}/stats/run")
async def run_statistical_test(dataset_id: str, request: StatsRequest, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch current dataset records
    query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id)
    response = query.execute()
    records = response.data
    
    if not records:
        raise HTTPException(status_code=400, detail="Dataset is empty.")
        
    df = pd.DataFrame([r["data"] for r in records])
    
    try:
        stat_val = None
        p_val = None
        dof = None
        
        # Helper to drop NaNs for two columns
        def clean_data(cols):
            return df[cols].dropna()

        if request.test_type == "T_TEST_IND":
            if not request.group_by:
                raise ValueError("group_by variable is required for Independent T-Test")
            clean_df = clean_data([request.variable_a, request.group_by])
            groups = [group[request.variable_a].values for name, group in clean_df.groupby(request.group_by)]
            if len(groups) != 2:
                raise ValueError(f"Independent T-Test requires exactly 2 groups in '{request.group_by}'. Found {len(groups)}.")
            res = stats.ttest_ind(groups[0], groups[1], equal_var=False) # Welch's t-test by default is safer
            stat_val = res.statistic
            p_val = res.pvalue
            dof = getattr(res, 'df', None)

        elif request.test_type == "ANOVA":
            if not request.group_by:
                raise ValueError("group_by variable is required for ANOVA")
            clean_df = clean_data([request.variable_a, request.group_by])
            groups = [group[request.variable_a].values for name, group in clean_df.groupby(request.group_by)]
            if len(groups) < 2:
                raise ValueError(f"ANOVA requires at least 2 groups in '{request.group_by}'.")
            res = stats.f_oneway(*groups)
            stat_val = res.statistic
            p_val = res.pvalue
            
        elif request.test_type == "T_TEST_PAIRED":
            if not request.variable_b:
                raise ValueError("variable_b is required for Paired T-Test")
            clean_df = clean_data([request.variable_a, request.variable_b])
            res = stats.ttest_rel(clean_df[request.variable_a], clean_df[request.variable_b])
            stat_val = res.statistic
            p_val = res.pvalue
            dof = getattr(res, 'df', None)

        elif request.test_type in ["PEARSON", "SPEARMAN"]:
            if not request.variable_b:
                raise ValueError(f"variable_b is required for {request.test_type}")
            clean_df = clean_data([request.variable_a, request.variable_b])
            if request.test_type == "PEARSON":
                res = stats.pearsonr(clean_df[request.variable_a], clean_df[request.variable_b])
            else:
                res = stats.spearmanr(clean_df[request.variable_a], clean_df[request.variable_b])
            stat_val = res.statistic
            p_val = res.pvalue

        elif request.test_type == "CHI_SQUARE":
            if not request.variable_b:
                raise ValueError("variable_b is required for Chi-Square test")
            clean_df = clean_data([request.variable_a, request.variable_b])
            contingency_table = pd.crosstab(clean_df[request.variable_a], clean_df[request.variable_b])
            res = stats.chi2_contingency(contingency_table)
            stat_val = res.statistic
            p_val = res.pvalue
            dof = res.dof
        else:
            raise ValueError(f"Unsupported test type: {request.test_type}")
            
        # Clean NaNs for JSON
        if stat_val is not None and math.isnan(stat_val): stat_val = None
        if p_val is not None and math.isnan(p_val): p_val = None
        if dof is not None and math.isnan(dof): dof = None

        interpretation = get_interpretation(p_val, request.test_type, request.variable_a, request.variable_b, request.group_by)

        test_data = {
            "dataset_id": dataset_id,
            "test_type": request.test_type,
            "variable_a": request.variable_a,
            "variable_b": request.variable_b,
            "group_by": request.group_by,
            "test_statistic": stat_val,
            "p_value": p_val,
            "degrees_of_freedom": dof,
            "interpretation": interpretation,
            "raw_results": {}
        }

        # Attempt to save to Supabase
        try:
            res = supabase.table("statistical_tests").insert(test_data).execute()
            test_result = res.data[0] if res.data else test_data
        except Exception as e:
            print(f"Error saving stat test to DB: {e}")
            test_result = test_data
            test_result["id"] = "test-id"

        return test_result

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Statistical Test failed: {str(e)}. Please check your variable selections and data types.")

@router.get("/{dataset_id}/stats")
async def get_stats(dataset_id: str, supabase: Client = Depends(get_supabase_client)):
    try:
        res = supabase.table("statistical_tests").select("*").eq("dataset_id", dataset_id).order("created_at", desc=True).execute()
        return res.data
    except Exception as e:
        print(f"Error fetching stats: {e}")
        return []
