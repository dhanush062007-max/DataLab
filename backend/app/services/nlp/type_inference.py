import pandas as pd
import re
from typing import Dict, Any, List

def infer_semantic_type(series: pd.Series) -> Dict[str, Any]:
    """
    Heuristically infer the semantic type and ML role of a pandas Series.
    """
    total = len(series)
    if total == 0:
        return {"semantic_type": "UNKNOWN", "ml_role": "IGNORE", "encoding_type": "NONE", "confidence": 0}
        
    non_null = series.dropna()
    non_null_count = len(non_null)
    
    if non_null_count == 0:
        return {"semantic_type": "UNKNOWN", "ml_role": "IGNORE", "encoding_type": "NONE", "confidence": 100}
        
    unique_vals = non_null.unique()
    unique_count = len(unique_vals)
    unique_ratio = unique_count / non_null_count
    
    # 1. Identifier Check (High uniqueness, usually strings or large ints)
    if unique_ratio > 0.95 and total > 10:
        if pd.api.types.is_string_dtype(series):
            # Check for UUIDs or Emails
            sample = str(non_null.iloc[0])
            if re.match(r'^[0-9a-fA-F]{8}-', sample) or '@' in sample or re.match(r'^[A-Za-z0-9_]{5,}$', sample):
                return {"semantic_type": "IDENTIFIER", "ml_role": "IGNORE", "encoding_type": "NONE", "confidence": 95}
        elif pd.api.types.is_numeric_dtype(series) and unique_ratio == 1.0:
            # Sequential ID
            return {"semantic_type": "IDENTIFIER", "ml_role": "IGNORE", "encoding_type": "NONE", "confidence": 90}
            
    # 2. Boolean Check
    if unique_count <= 2:
        vals_lower = {str(v).lower().strip() for v in unique_vals}
        bool_sets = [{'true', 'false'}, {'yes', 'no'}, {'1', '0'}, {'1.0', '0.0'}, {'y', 'n'}]
        if any(vals_lower.issubset(bset) for bset in bool_sets):
            return {"semantic_type": "BOOLEAN", "ml_role": "FEATURE", "encoding_type": "NUMERIC_SCALED", "confidence": 98}

    # 3. Numeric (Integer / Decimal)
    if pd.api.types.is_numeric_dtype(series):
        if pd.api.types.is_integer_dtype(series) or all(x.is_integer() for x in non_null if isinstance(x, float)):
            return {"semantic_type": "INTEGER", "ml_role": "FEATURE", "encoding_type": "NUMERIC_SCALED", "confidence": 95}
        return {"semantic_type": "DECIMAL", "ml_role": "FEATURE", "encoding_type": "NUMERIC_SCALED", "confidence": 95}
        
    # 4. Date / DateTime
    # Try converting a sample to datetime
    if pd.api.types.is_string_dtype(series) or pd.api.types.is_object_dtype(series):
        try:
            sample_dates = pd.to_datetime(non_null.head(10), errors='coerce')
            if sample_dates.notna().all():
                # Check if it has time component
                has_time = any(d.hour != 0 or d.minute != 0 for d in sample_dates)
                if has_time:
                    return {"semantic_type": "DATETIME", "ml_role": "FEATURE", "encoding_type": "NUMERIC_SCALED", "confidence": 90}
                return {"semantic_type": "DATE", "ml_role": "FEATURE", "encoding_type": "NUMERIC_SCALED", "confidence": 90}
        except:
            pass

    # 5. Text-based types
    if pd.api.types.is_string_dtype(series) or pd.api.types.is_object_dtype(series):
        # Calculate average length and words
        str_series = non_null.astype(str)
        avg_len = str_series.str.len().mean()
        avg_words = str_series.str.split().apply(len).mean()
        
        # Multiple Choice / Tags check (comma separated usually)
        if unique_ratio > 0.1 and avg_words < 5:
            has_commas = str_series.str.contains(',').sum() / non_null_count > 0.1
            if has_commas:
                # E.g. "Python, SQL, Java"
                return {"semantic_type": "MULTIPLE_CHOICE", "ml_role": "FEATURE", "encoding_type": "MULTI_HOT", "confidence": 85}

        # Category check (low cardinality)
        if unique_count <= 20 or (unique_count < 100 and unique_ratio < 0.1):
            return {"semantic_type": "CATEGORY", "ml_role": "FEATURE", "encoding_type": "ONE_HOT", "confidence": 85}
            
        # Long Text (NLP)
        if avg_words > 10 or avg_len > 50:
            return {"semantic_type": "LONG_TEXT", "ml_role": "FEATURE", "encoding_type": "TFIDF", "confidence": 90}
            
        # Short Text
        return {"semantic_type": "SHORT_TEXT", "ml_role": "FEATURE", "encoding_type": "TFIDF", "confidence": 70}
        
    return {"semantic_type": "UNKNOWN", "ml_role": "IGNORE", "encoding_type": "NONE", "confidence": 0}
