import pandas as pd
import numpy as np
from typing import Dict, Any, List
import math

try:
    from scipy import stats
except ImportError:
    pass

class StatsEngine:
    @staticmethod
    def auto_discover_insights(df: pd.DataFrame, column_metadata: List[Dict[str, Any]], max_insights: int = 5) -> List[Dict[str, Any]]:
        """
        Automatically discovers the most statistically significant relationships
        in the dataset by scanning numeric vs numeric and numeric vs categorical pairs.
        """
        insights = []
        if df.empty or len(df) < 10:
            return insights

        numeric_cols = []
        cat_cols = []

        for col in column_metadata:
            c_name = col["column_name"]
            c_type = col.get("semantic_type", col.get("data_type", "UNKNOWN"))
            if c_name not in df.columns: continue
            
            if c_type in ["INTEGER", "DECIMAL"] or pd.api.types.is_numeric_dtype(df[c_name]):
                numeric_cols.append(c_name)
            elif c_type in ["CATEGORY", "SINGLE_CHOICE", "ORDINAL_CHOICE", "BOOLEAN"]:
                # Only consider categories with a reasonable number of unique values
                if 1 < df[c_name].nunique() < 20:
                    cat_cols.append(c_name)

        # 1. Numeric vs Numeric (Pearson Correlation)
        for i in range(len(numeric_cols)):
            for j in range(i + 1, len(numeric_cols)):
                col_a = numeric_cols[i]
                col_b = numeric_cols[j]
                
                clean_df = df[[col_a, col_b]].apply(pd.to_numeric, errors='coerce').dropna()
                if len(clean_df) < 10: continue
                
                try:
                    r, p_val = stats.pearsonr(clean_df[col_a], clean_df[col_b])
                    if not math.isnan(p_val) and p_val < 0.05:
                        strength = "strong" if abs(r) > 0.6 else "moderate" if abs(r) > 0.3 else "weak"
                        direction = "positive" if r > 0 else "negative"
                        insights.append({
                            "type": "correlation",
                            "variable_a": col_a,
                            "variable_b": col_b,
                            "p_value": p_val,
                            "effect_size": r,
                            "description": f"There is a statistically significant, {strength} {direction} correlation (r={r:.2f}) between '{col_a}' and '{col_b}'."
                        })
                except:
                    pass

        # 2. Numeric vs Categorical (ANOVA / T-Test)
        for num_col in numeric_cols:
            for cat_col in cat_cols:
                clean_df = df[[num_col, cat_col]].dropna()
                clean_df[num_col] = pd.to_numeric(clean_df[num_col], errors='coerce')
                clean_df = clean_df.dropna()
                
                if len(clean_df) < 10: continue
                
                groups = [group[num_col].values for name, group in clean_df.groupby(cat_col)]
                if len(groups) < 2: continue
                
                try:
                    if len(groups) == 2:
                        stat_val, p_val = stats.ttest_ind(groups[0], groups[1], equal_var=False)
                        test_name = "Independent T-Test"
                    else:
                        stat_val, p_val = stats.f_oneway(*groups)
                        test_name = "ANOVA"
                        
                    if not math.isnan(p_val) and p_val < 0.05:
                        insights.append({
                            "type": "difference",
                            "variable_a": num_col,
                            "variable_b": cat_col,
                            "p_value": p_val,
                            "effect_size": stat_val, # Using stat_val as a proxy for sorting if needed
                            "description": f"'{num_col}' varies significantly across different groups of '{cat_col}' (p={p_val:.4f})."
                        })
                except:
                    pass

        # 3. Categorical vs Categorical (Chi-Square)
        for i in range(len(cat_cols)):
            for j in range(i + 1, len(cat_cols)):
                col_a = cat_cols[i]
                col_b = cat_cols[j]
                
                clean_df = df[[col_a, col_b]].dropna()
                if len(clean_df) < 20: continue # Chi-square needs more data
                
                try:
                    contingency_table = pd.crosstab(clean_df[col_a], clean_df[col_b])
                    # Check if table is valid for chi-square (min expected frequencies)
                    if contingency_table.size == 0 or (contingency_table < 5).sum().sum() > contingency_table.size * 0.2:
                        continue
                        
                    res = stats.chi2_contingency(contingency_table)
                    p_val = res.pvalue
                    
                    if not math.isnan(p_val) and p_val < 0.05:
                        insights.append({
                            "type": "association",
                            "variable_a": col_a,
                            "variable_b": col_b,
                            "p_value": p_val,
                            "effect_size": res.statistic,
                            "description": f"There is a statistically significant association between '{col_a}' and '{col_b}' (p={p_val:.4f}). They are dependent."
                        })
                except:
                    pass

        # Sort insights by p_value (most significant first)
        insights.sort(key=lambda x: x["p_value"])
        
        return insights[:max_insights]
