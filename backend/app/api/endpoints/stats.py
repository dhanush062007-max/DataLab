from fastapi import APIRouter, HTTPException, Depends, Request
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
from app.core.rate_limit import limiter

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
@limiter.limit("5/minute")
def run_statistical_test(request: Request, dataset_id: str, stats_req: StatsRequest, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch active version
    d_res = supabase.table("datasets").select("active_version_id").eq("id", dataset_id).single().execute()
    active_version_id = d_res.data.get("active_version_id") if d_res.data else None
    
    chunk_size = 1000
    current_offset = 0
    
    # 2. Extract only necessary columns out-of-core
    var_a_list = []
    var_b_list = []
    group_list = []
    
    req_a = stats_req.variable_a
    req_b = stats_req.variable_b
    req_g = stats_req.group_by
    
    while True:
        query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).order("id").range(current_offset, current_offset + chunk_size - 1)
        if active_version_id:
            query = query.eq("version_id", active_version_id)
        else:
            query = query.is_("version_id", "null")
            
        res = query.execute()
        fetched = res.data
        
        if not fetched:
            break
            
        for r in fetched:
            row = r["data"]
            val_a = row.get(req_a)
            val_b = row.get(req_b) if req_b else None
            val_g = row.get(req_g) if req_g else None
            
            var_a_list.append(val_a)
            var_b_list.append(val_b)
            group_list.append(val_g)
            
        if len(fetched) < chunk_size:
            break
            
        current_offset += chunk_size
        
    if not var_a_list:
        raise HTTPException(status_code=400, detail="Dataset is empty or columns not found.")
        
    # Convert into a compact Pandas DataFrame to reuse SciPy logic
    df_data = {req_a: var_a_list}
    if req_b: df_data[req_b] = var_b_list
    if req_g: df_data[req_g] = group_list
    
    df = pd.DataFrame(df_data)
    
    try:
        stat_val = None
        p_val = None
        dof = None
        
        def clean_data(cols):
            temp_df = df[cols].copy()
            for col in cols:
                # Grouping variable should remain as categorical/strings
                if col == req_g:
                    continue
                # Force coerce other columns to numeric (invalid strings become NaN)
                temp_df[col] = pd.to_numeric(temp_df[col], errors='coerce')
            return temp_df.dropna()

        if stats_req.test_type == "T_TEST_IND":
            if not req_g:
                raise ValueError("group_by variable is required for Independent T-Test")
            clean_df = clean_data([req_a, req_g])
            groups = [group[req_a].values for name, group in clean_df.groupby(req_g)]
            if len(groups) != 2:
                raise ValueError(f"Independent T-Test requires exactly 2 groups in '{req_g}'. Found {len(groups)}.")
            res = stats.ttest_ind(groups[0], groups[1], equal_var=False) # Welch's t-test by default is safer
            stat_val = res.statistic
            p_val = res.pvalue
            dof = getattr(res, 'df', None)

        elif stats_req.test_type == "ANOVA":
            if not req_g:
                raise ValueError("group_by variable is required for ANOVA")
            clean_df = clean_data([req_a, req_g])
            groups = [group[req_a].values for name, group in clean_df.groupby(req_g)]
            if len(groups) < 2:
                raise ValueError(f"ANOVA requires at least 2 groups in '{req_g}'.")
            res = stats.f_oneway(*groups)
            stat_val = res.statistic
            p_val = res.pvalue
            
        elif stats_req.test_type == "T_TEST_PAIRED":
            if not req_b:
                raise ValueError("variable_b is required for Paired T-Test")
            clean_df = clean_data([req_a, req_b])
            res = stats.ttest_rel(clean_df[req_a], clean_df[req_b])
            stat_val = res.statistic
            p_val = res.pvalue
            dof = getattr(res, 'df', None)

        elif stats_req.test_type in ["PEARSON", "SPEARMAN"]:
            if not req_b:
                raise ValueError(f"variable_b is required for {stats_req.test_type}")
            clean_df = clean_data([req_a, req_b])
            if stats_req.test_type == "PEARSON":
                res = stats.pearsonr(clean_df[req_a], clean_df[req_b])
            else:
                res = stats.spearmanr(clean_df[req_a], clean_df[req_b])
            stat_val = res.statistic
            p_val = res.pvalue

        elif stats_req.test_type == "CHI_SQUARE":
            if not req_b:
                raise ValueError("variable_b is required for Chi-Square test")
            clean_df = df[[req_a, req_b]].dropna()
            contingency_table = pd.crosstab(clean_df[req_a], clean_df[req_b])
            res = stats.chi2_contingency(contingency_table)
            stat_val = res.statistic
            p_val = res.pvalue
            dof = res.dof
        else:
            raise ValueError(f"Unsupported test type: {stats_req.test_type}")
            
        # Clean NaNs for JSON
        if stat_val is not None and math.isnan(stat_val): stat_val = None
        if p_val is not None and math.isnan(p_val): p_val = None
        if dof is not None and math.isnan(dof): dof = None

        interpretation = get_interpretation(p_val, stats_req.test_type, req_a, req_b, req_g)

        test_data = {
            "dataset_id": dataset_id,
            "test_type": stats_req.test_type,
            "variable_a": req_a,
            "variable_b": req_b,
            "group_by": req_g,
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
def get_stats(dataset_id: str, supabase: Client = Depends(get_supabase_client)):
    try:
        res = supabase.table("statistical_tests").select("*").eq("dataset_id", dataset_id).order("created_at", desc=True).execute()
        return res.data
    except Exception as e:
        print(f"Error fetching stats: {e}")
        return []

from app.services.stats_engine import StatsEngine

@router.get("/{dataset_id}/stats/insights")
def get_auto_insights(dataset_id: str, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch active version
    d_res = supabase.table("datasets").select("active_version_id").eq("id", dataset_id).single().execute()
    if not d_res.data:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    active_version_id = d_res.data.get("active_version_id")
    
    # 2. Fetch column metadata
    c_res = supabase.table("dataset_columns").select("*").eq("dataset_id", dataset_id).execute()
    if not c_res.data:
        return []
    column_metadata = c_res.data

    # 3. Fetch sample records (limit to 2000 for fast insight generation)
    query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).limit(2000)
    if active_version_id:
        query = query.eq("version_id", active_version_id)
    else:
        query = query.is_("version_id", "null")
        
    r_res = query.execute()
    if not r_res.data:
        return []
        
    df = pd.DataFrame([r["data"] for r in r_res.data])
    
    try:
        insights = StatsEngine.auto_discover_insights(df, column_metadata, max_insights=6)
        return insights
    except Exception as e:
        print(f"Error generating insights: {e}")
        return []
