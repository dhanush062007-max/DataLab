import pandas as pd
import numpy as np
import re
from typing import Dict, Any, List

class AssistantEngine:
    @staticmethod
    def answer_query(query: str, df: pd.DataFrame, column_metadata: List[Dict[str, Any]]) -> str:
        """
        Parses a natural language query and maps it to deterministic pandas operations on the dataset.
        """
        query = query.lower()
        columns_lower = {col["column_name"].lower(): col["column_name"] for col in column_metadata}
        
        # 1. Detect target column
        target_col = None
        for col_l, col_orig in columns_lower.items():
            if col_l in query:
                # To prevent matching substrings like "id" in "average height", we can use word boundaries
                if re.search(rf'\b{re.escape(col_l)}\b', query):
                    target_col = col_orig
                    break
                    
        # 2. Detect Intent
        is_count = "count" in query or "how many" in query
        is_avg = "average" in query or "mean" in query
        is_max = "max" in query or "highest" in query or "maximum" in query
        is_min = "min" in query or "lowest" in query or "minimum" in query
        
        if not target_col:
            # Maybe they just want row count
            if is_count and "row" in query or "record" in query:
                return f"There are {len(df):,} rows in this dataset."
            return "I couldn't identify a specific column in your question. Please mention the exact column name."
            
        # 3. Execution
        try:
            series = df[target_col]
            
            if is_count:
                # Let's see if they are asking for a specific value count
                # E.g., "how many students have 'Male' as Gender"
                for val in series.dropna().unique():
                    if str(val).lower() in query:
                        count_val = (series.astype(str).str.lower() == str(val).lower()).sum()
                        return f"There are {count_val:,} records where {target_col} is '{val}'."
                
                # Otherwise just non-null count
                return f"There are {series.notna().sum():,} non-empty records for '{target_col}'."
                
            if is_avg:
                numeric_series = pd.to_numeric(series, errors='coerce').dropna()
                if len(numeric_series) == 0:
                    return f"'{target_col}' doesn't seem to contain numeric data, so I can't calculate an average."
                return f"The average for '{target_col}' is {numeric_series.mean():.2f}."
                
            if is_max:
                numeric_series = pd.to_numeric(series, errors='coerce').dropna()
                if len(numeric_series) == 0:
                    return f"'{target_col}' doesn't seem to contain numeric data, so I can't find a maximum."
                return f"The maximum value for '{target_col}' is {numeric_series.max():.2f}."
                
            if is_min:
                numeric_series = pd.to_numeric(series, errors='coerce').dropna()
                if len(numeric_series) == 0:
                    return f"'{target_col}' doesn't seem to contain numeric data, so I can't find a minimum."
                return f"The minimum value for '{target_col}' is {numeric_series.min():.2f}."
                
            # Default to summary
            numeric_series = pd.to_numeric(series, errors='coerce').dropna()
            if len(numeric_series) > len(series) * 0.5:
                # Mostly numeric
                return f"'{target_col}' is mostly numeric. Its average is {numeric_series.mean():.2f}, ranging from {numeric_series.min()} to {numeric_series.max()}."
            else:
                # Mostly categorical
                top_val = series.mode().iloc[0] if not series.mode().empty else "None"
                return f"'{target_col}' has {series.nunique():,} unique values. The most common value is '{top_val}'."
                
        except Exception as e:
            return f"I encountered an error trying to process your request for '{target_col}'. Error: {str(e)}"
