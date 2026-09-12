import pandas as pd
import numpy as np
from enum import Enum
from typing import Dict, Any, Tuple

class ColumnSemanticType(str, Enum):
    INTEGER = 'INTEGER'
    DECIMAL = 'DECIMAL'
    BOOLEAN = 'BOOLEAN'
    CATEGORY = 'CATEGORY'
    TAGS = 'TAGS'
    SINGLE_CHOICE = 'SINGLE_CHOICE'
    ORDINAL_CHOICE = 'ORDINAL_CHOICE'
    MULTIPLE_CHOICE = 'MULTIPLE_CHOICE'
    DATE = 'DATE'
    DATETIME = 'DATETIME'
    SHORT_TEXT = 'SHORT_TEXT'
    LONG_TEXT = 'LONG_TEXT'
    IDENTIFIER = 'IDENTIFIER'
    TARGET = 'TARGET'
    UNKNOWN = 'UNKNOWN'

class ColumnMLRole(str, Enum):
    FEATURE = 'FEATURE'
    TARGET = 'TARGET'
    IGNORE = 'IGNORE'

class ColumnEncodingType(str, Enum):
    NUMERIC_SCALED = 'NUMERIC_SCALED'
    ONE_HOT = 'ONE_HOT'
    MULTI_HOT = 'MULTI_HOT'
    ORDINAL = 'ORDINAL'
    TFIDF = 'TFIDF'
    EMBEDDING = 'EMBEDDING'
    NONE = 'NONE'

class SemanticTypeEngine:
    @staticmethod
    def detect_semantic_type(series: pd.Series, column_name: str) -> Tuple[ColumnSemanticType, Dict[str, Any]]:
        """
        Detect the semantic type of a pandas Series (column) using heuristics.
        Returns the type and a dictionary of metadata (like confidence, cardinality, etc.).
        """
        # Drop missing values for analysis
        s = series.dropna()
        n = len(s)
        if n == 0:
            return ColumnSemanticType.UNKNOWN, {"confidence": 1.0, "reason": "Empty column"}

        unique_vals = s.unique()
        cardinality = len(unique_vals)
        cardinality_ratio = cardinality / n if n > 0 else 0

        metadata = {
            "cardinality": cardinality,
            "missing_count": len(series) - n,
            "missing_percentage": (len(series) - n) / len(series) * 100,
            "unique_values_sample": unique_vals[:5].tolist(),
        }

        col_name_lower = str(column_name).lower()

        # Identifier check
        if cardinality_ratio > 0.95 and (
            'id' in col_name_lower or 
            'uuid' in col_name_lower or
            'email' in col_name_lower
        ):
            metadata["confidence"] = 0.9
            return ColumnSemanticType.IDENTIFIER, metadata

        # Boolean check
        if cardinality <= 2:
            bool_heuristics = [
                set([True, False]),
                set([0, 1]),
                set(['0', '1']),
                set(['true', 'false']),
                set(['t', 'f']),
                set(['yes', 'no']),
                set(['y', 'n'])
            ]
            s_set = set(str(v).lower() for v in unique_vals)
            for heur in bool_heuristics:
                if s_set.issubset(heur):
                    metadata["confidence"] = 0.95
                    return ColumnSemanticType.BOOLEAN, metadata

        # Numeric check
        is_numeric = pd.api.types.is_numeric_dtype(series)
        if is_numeric:
            # Check if integer
            if pd.api.types.is_integer_dtype(series) or (s == s.astype(int)).all():
                # Differentiate between regular integer and categorical
                if cardinality < 15 and cardinality_ratio < 0.1:
                    metadata["confidence"] = 0.7
                    return ColumnSemanticType.CATEGORY, metadata
                
                metadata["confidence"] = 0.9
                return ColumnSemanticType.INTEGER, metadata
            else:
                metadata["confidence"] = 0.9
                return ColumnSemanticType.DECIMAL, metadata

        # Date/Datetime check
        try:
            # Attempt to convert a sample to datetime to quickly check
            sample = s.iloc[:min(100, n)]
            parsed = pd.to_datetime(sample, errors='coerce')
            if parsed.notna().mean() > 0.8: # If 80% of sample can be parsed
                # Re-parse full series to check time component
                full_parsed = pd.to_datetime(s, errors='coerce').dropna()
                has_time = (full_parsed.dt.time != pd.Timestamp('00:00:00').time()).any()
                
                metadata["confidence"] = 0.85
                if has_time:
                    return ColumnSemanticType.DATETIME, metadata
                return ColumnSemanticType.DATE, metadata
        except Exception:
            pass

        # String / Category checks
        s_str = s.astype(str)
        
        # Multiple Choice / Tags check (contains commas or pipes)
        # e.g., "Python, SQL, R"
        if s_str.str.contains(r'[,|;]').any():
            avg_length = s_str.str.len().mean()
            if avg_length < 100:
                metadata["confidence"] = 0.8
                return ColumnSemanticType.MULTIPLE_CHOICE, metadata

        # Categorical / Single Choice
        # If the number of unique strings is small compared to total
        if cardinality < 20 or (cardinality_ratio < 0.05 and cardinality < 100):
            # Check for ordinal cues in names or just default to single choice
            ordinal_cues = ['poor', 'good', 'excellent', 'low', 'medium', 'high']
            if any(cue in val.lower() for val in s_str.unique()[:20] for cue in ordinal_cues):
                metadata["confidence"] = 0.7
                return ColumnSemanticType.ORDINAL_CHOICE, metadata
            
            metadata["confidence"] = 0.85
            return ColumnSemanticType.SINGLE_CHOICE, metadata

        # Text Analysis
        avg_words = s_str.str.split().str.len().mean()
        if avg_words > 15:
            metadata["confidence"] = 0.9
            return ColumnSemanticType.LONG_TEXT, metadata
        elif avg_words > 3:
            metadata["confidence"] = 0.8
            return ColumnSemanticType.SHORT_TEXT, metadata

        metadata["confidence"] = 0.5
        return ColumnSemanticType.UNKNOWN, metadata

    @staticmethod
    def get_ml_recommendations(semantic_type: ColumnSemanticType) -> Tuple[ColumnMLRole, ColumnEncodingType]:
        if semantic_type == ColumnSemanticType.IDENTIFIER:
            return ColumnMLRole.IGNORE, ColumnEncodingType.NONE
        elif semantic_type in (ColumnSemanticType.INTEGER, ColumnSemanticType.DECIMAL):
            return ColumnMLRole.FEATURE, ColumnEncodingType.NUMERIC_SCALED
        elif semantic_type == ColumnSemanticType.BOOLEAN:
            return ColumnMLRole.FEATURE, ColumnEncodingType.NONE # Usually 0/1 anyway
        elif semantic_type in (ColumnSemanticType.CATEGORY, ColumnSemanticType.SINGLE_CHOICE):
            return ColumnMLRole.FEATURE, ColumnEncodingType.ONE_HOT
        elif semantic_type == ColumnSemanticType.ORDINAL_CHOICE:
            return ColumnMLRole.FEATURE, ColumnEncodingType.ORDINAL
        elif semantic_type in (ColumnSemanticType.MULTIPLE_CHOICE, ColumnSemanticType.TAGS):
            return ColumnMLRole.FEATURE, ColumnEncodingType.MULTI_HOT
        elif semantic_type in (ColumnSemanticType.LONG_TEXT, ColumnSemanticType.SHORT_TEXT):
            return ColumnMLRole.FEATURE, ColumnEncodingType.TFIDF
        elif semantic_type in (ColumnSemanticType.DATE, ColumnSemanticType.DATETIME):
            return ColumnMLRole.FEATURE, ColumnEncodingType.NUMERIC_SCALED # Or extract year/month
        else:
            return ColumnMLRole.IGNORE, ColumnEncodingType.NONE
