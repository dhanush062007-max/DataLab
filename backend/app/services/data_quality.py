import pandas as pd
import numpy as np
from typing import Dict, Any, List
from app.services.semantic_engine import ColumnSemanticType

class DataQualityEngine:
    @staticmethod
    def compute_quality_score(df: pd.DataFrame, column_metadata: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Compute overall Data Quality Score and generate actionable warnings.
        """
        warnings = []
        
        if df.empty:
            return {"score": 0, "warnings": ["Dataset is completely empty."], "breakdown": {}}

        total_cells = df.size
        total_rows = len(df)
        
        # 1. Completeness (Missing values)
        missing_count = df.isna().sum().sum()
        completeness_score = max(0, 100 - (missing_count / total_cells * 100)) if total_cells > 0 else 0
        if missing_count > 0:
            warnings.append({
                "type": "completeness",
                "severity": "warning",
                "message": f"{missing_count} missing value(s) detected across the dataset."
            })

        # 2. Uniqueness (Duplicates)
        duplicate_count = df.duplicated().sum()
        uniqueness_score = max(0, 100 - (duplicate_count / total_rows * 100))
        if duplicate_count > 0:
            warnings.append({
                "type": "uniqueness",
                "severity": "error" if duplicate_count / total_rows > 0.1 else "warning",
                "message": f"{duplicate_count} duplicate record(s) detected."
            })

        # 3. Validity & Consistency (per column checks)
        outlier_count = 0
        inconsistent_categories_count = 0
        
        for col_meta in column_metadata:
            col_name = col_meta["column_name"]
            sem_type = col_meta.get("semantic_type", "UNKNOWN")
            
            if col_name not in df.columns:
                continue
                
            series = df[col_name].dropna()
            
            # Numeric Outliers (IQR method)
            if sem_type in ["INTEGER", "DECIMAL"] or pd.api.types.is_numeric_dtype(series):
                numeric_series = pd.to_numeric(series, errors='coerce').dropna()
                if len(numeric_series) > 10:
                    q1 = numeric_series.quantile(0.25)
                    q3 = numeric_series.quantile(0.75)
                    iqr = q3 - q1
                    lower_bound = q1 - 1.5 * iqr
                    upper_bound = q3 + 1.5 * iqr
                    
                    outliers = numeric_series[(numeric_series < lower_bound) | (numeric_series > upper_bound)]
                    if len(outliers) > 0:
                        outlier_count += len(outliers)
                        warnings.append({
                            "type": "outlier",
                            "severity": "warning",
                            "message": f"{len(outliers)} possible outlier(s) detected in column '{col_name}'.",
                            "column": col_name
                        })
            
            # Inconsistent Categories (Case & Whitespace differences)
            if sem_type in ["CATEGORY", "SINGLE_CHOICE"]:
                val_counts = series.astype(str).value_counts()
                normalized = series.astype(str).str.lower().str.strip()
                norm_counts = normalized.value_counts()
                
                # If normalizing reduces cardinality, we have inconsistencies
                if len(norm_counts) < len(val_counts):
                    inconsistent_categories_count += 1
                    warnings.append({
                        "type": "consistency",
                        "severity": "warning",
                        "message": f"Inconsistent category names (capitalization/spacing) detected in '{col_name}'.",
                        "column": col_name
                    })

        # Score Deductions
        outlier_score = max(0, 100 - (outlier_count / total_cells * 100 * 2)) # Outliers heavily penalize
        consistency_score = max(0, 100 - (inconsistent_categories_count * 5))
        
        # Overall Score (Weighted)
        weights = {
            "completeness": 0.4,
            "uniqueness": 0.3,
            "consistency": 0.2,
            "outliers": 0.1
        }
        
        overall_score = (
            (completeness_score * weights["completeness"]) +
            (uniqueness_score * weights["uniqueness"]) +
            (consistency_score * weights["consistency"]) +
            (outlier_score * weights["outliers"])
        )

        # Sort warnings by severity (errors first)
        warnings.sort(key=lambda x: 0 if x["severity"] == "error" else 1)

        return {
            "score": round(overall_score, 1),
            "breakdown": {
                "completeness": round(completeness_score, 1),
                "uniqueness": round(uniqueness_score, 1),
                "consistency": round(consistency_score, 1),
                "outlier_risk": round(outlier_score, 1)
            },
            "warnings": warnings
        }

    @staticmethod
    def get_cleaning_suggestions(df: pd.DataFrame, column_name: str) -> Dict[str, Any]:
        """
        Generate smart cleaning suggestions for a specific column.
        """
        series = df[column_name]
        suggestions = []
        
        if series.isna().sum() > 0:
            suggestions.append({
                "type": "missing_values",
                "action": "impute",
                "description": "Fill missing values with mean/median (if numeric) or mode (if categorical)."
            })
            suggestions.append({
                "type": "missing_values",
                "action": "drop",
                "description": "Drop rows with missing values."
            })
            
        # Check text normalization
        if series.dtype == 'object':
            s_str = series.dropna().astype(str)
            s_lower = s_str.str.lower().str.strip()
            
            if len(s_lower.unique()) < len(s_str.unique()):
                # Give a preview of what will change
                changes = {}
                for original, lower in zip(s_str, s_lower):
                    if original != lower and lower in changes:
                        if original not in changes[lower]:
                            changes[lower].append(original)
                    elif original != lower:
                        changes[lower] = [original]
                        
                suggestions.append({
                    "type": "normalization",
                    "action": "normalize_text",
                    "description": "Standardize capitalization and trailing spaces.",
                    "preview": {k: list(set(v)) for k, v in list(changes.items())[:5]} # preview up to 5
                })

        return {
            "column": column_name,
            "suggestions": suggestions
        }
