import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
import math
import traceback
from supabase import Client

try:
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler, OneHotEncoder
    from sklearn.compose import ColumnTransformer
    from sklearn.pipeline import Pipeline
    from sklearn.impute import SimpleImputer
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    from sklearn.linear_model import LogisticRegression, LinearRegression
    from sklearn.metrics import accuracy_score, f1_score, mean_squared_error, r2_score
except ImportError:
    pass

class MLEngine:
    @staticmethod
    def _detect_task_type(target_col: str, column_metadata: List[Dict[str, Any]]) -> str:
        """Auto-detects whether the task is Classification or Regression based on semantic type."""
        for col in column_metadata:
            if col["column_name"] == target_col:
                sem_type = col.get("semantic_type") or col.get("data_type")
                if sem_type in ["CATEGORY", "SINGLE_CHOICE", "ORDINAL_CHOICE", "BOOLEAN", "VARCHAR"]:
                    return "CLASSIFICATION"
                elif sem_type in ["INTEGER", "DECIMAL", "NUMERIC"]:
                    return "REGRESSION"
        return "REGRESSION" # Default fallback

    @staticmethod
    def _prevent_data_leakage(target_col: str, feature_cols: List[str], column_metadata: List[Dict[str, Any]]) -> List[str]:
        """Removes the target column and obvious ID columns to prevent data leakage."""
        safe_features = []
        for col in feature_cols:
            if col == target_col:
                continue
            
            # Check for identifiers (which leak perfectly unique leakage, or are useless)
            sem_type = None
            for c in column_metadata:
                if c["column_name"] == col:
                    sem_type = c.get("semantic_type")
                    break
            
            if sem_type == "IDENTIFIER":
                continue # Skip ID columns
                
            safe_features.append(col)
            
        return safe_features

    @staticmethod
    def train_model(
        dataset_id: str, 
        target_column: str, 
        feature_columns: List[str], 
        base_algorithm: str, # "RANDOM_FOREST" or "LINEAR_MODEL"
        df: pd.DataFrame,
        column_metadata: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Trains an AutoML Lite pipeline with automated preprocessing and task detection.
        """
        task_type = MLEngine._detect_task_type(target_column, column_metadata)
        safe_features = MLEngine._prevent_data_leakage(target_column, feature_columns, column_metadata)
        
        if not safe_features:
            raise ValueError("No valid features remaining after data leakage prevention.")
            
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found in data.")
            
        # Drop rows where target is missing
        df_clean = df.dropna(subset=[target_column]).copy()
        if len(df_clean) < 10:
            raise ValueError("Not enough valid data rows to train a model.")
            
        X = df_clean[safe_features]
        y = df_clean[target_column]
        
        if task_type == "CLASSIFICATION":
            y = y.astype(str)
        else:
            y = pd.to_numeric(y, errors='coerce')
            valid_idx = y.notna()
            X = X[valid_idx]
            y = y[valid_idx]
            if len(X) < 10:
                raise ValueError("Not enough numeric target values to train a regression model.")

        # Build Pipeline Preprocessor
        numeric_features = []
        categorical_features = []
        
        for col in safe_features:
            c_meta = next((c for c in column_metadata if c["column_name"] == col), None)
            c_type = c_meta.get("semantic_type") or c_meta.get("data_type") if c_meta else "VARCHAR"
            
            if c_type in ["INTEGER", "DECIMAL", "NUMERIC"]:
                numeric_features.append(col)
            else:
                categorical_features.append(col)
                
        numeric_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler())
        ])
        
        categorical_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='constant', fill_value='missing')),
            ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False)) # sparse_output=False to allow SHAP later if needed
        ])
        
        transformers = []
        if numeric_features:
            transformers.append(('num', numeric_transformer, numeric_features))
        if categorical_features:
            transformers.append(('cat', categorical_transformer, categorical_features))
            
        preprocessor = ColumnTransformer(transformers=transformers)
        
        # Select Algorithm
        if task_type == "CLASSIFICATION":
            if base_algorithm == "RANDOM_FOREST":
                model = RandomForestClassifier(n_estimators=50, random_state=42)
            else:
                model = LogisticRegression(max_iter=1000, random_state=42)
        else:
            if base_algorithm == "RANDOM_FOREST":
                model = RandomForestRegressor(n_estimators=50, random_state=42)
            else:
                model = LinearRegression()
                
        pipeline = Pipeline(steps=[('preprocessor', preprocessor), ('model', model)])
        
        # Split and train
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)
        
        # Metrics
        metrics = {}
        if task_type == "CLASSIFICATION":
            metrics["accuracy"] = float(accuracy_score(y_test, y_pred))
            metrics["f1_score"] = float(f1_score(y_test, y_pred, average='weighted', zero_division=0))
        else:
            mse_val = float(mean_squared_error(y_test, y_pred))
            metrics["mse"] = mse_val
            metrics["rmse"] = float(math.sqrt(mse_val))
            metrics["r2"] = float(r2_score(y_test, y_pred))
            
        # Clean Metrics
        for k, v in metrics.items():
            if math.isnan(v):
                metrics[k] = None
                
        # Feature Importances extraction via SHAP
        from app.services.ml_explainability import MLExplainability
        
        feature_importances = {}
        try:
            # Get feature names after preprocessing
            feature_names = []
            if numeric_features:
                feature_names.extend(numeric_features)
            if categorical_features:
                cat_encoder = preprocessor.named_transformers_['cat'].named_steps['onehot']
                cat_names = cat_encoder.get_feature_names_out(categorical_features)
                feature_names.extend(cat_names)
                
            trained_model = pipeline.named_steps['model']
            
            # Preprocess the background data to feed into SHAP
            X_train_preprocessed = preprocessor.transform(X_train)
            
            # Since SHAP requires a dataframe with feature names for tree explainer, 
            # and our preprocessor outputs a NumPy array, we wrap it in a DataFrame
            X_train_processed_df = pd.DataFrame(X_train_preprocessed, columns=feature_names)
            
            feature_importances = MLExplainability.compute_global_shap(trained_model, X_train_processed_df, feature_names)
            
            # Fallback to model-specific importances if SHAP fails or is missing
            if not feature_importances:
                if hasattr(trained_model, 'feature_importances_'):
                    importances = trained_model.feature_importances_
                    for name, imp in zip(feature_names, importances):
                        feature_importances[name] = float(imp)
                elif hasattr(trained_model, 'coef_'):
                    coefs = np.abs(trained_model.coef_[0] if len(trained_model.coef_.shape) > 1 else trained_model.coef_)
                    for name, coef in zip(feature_names, coefs):
                        feature_importances[name] = float(coef)
                        
                # Normalize fallback importances to sum to 1
                total_imp = sum(feature_importances.values())
                if total_imp > 0:
                    feature_importances = {k: v/total_imp for k, v in feature_importances.items()}
                feature_importances = dict(sorted(feature_importances.items(), key=lambda item: item[1], reverse=True))
                
        except Exception as e:
            print(f"Failed to extract feature importances: {e}")
            
        return {
            "dataset_id": dataset_id,
            "model_name": f"{base_algorithm} ({task_type}) - {target_column}",
            "target_column": target_column,
            "feature_columns": safe_features,
            "algorithm": f"{base_algorithm}_{task_type}",
            "task_type": task_type,
            "metrics": metrics,
            "feature_importances": feature_importances,
            "status": "completed"
        }
