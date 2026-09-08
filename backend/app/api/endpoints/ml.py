from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from supabase import Client
from app.core.supabase import get_supabase_client
import pandas as pd
import json
import math
import numpy as np

try:
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler, OrdinalEncoder
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.compose import ColumnTransformer
    from sklearn.pipeline import Pipeline
    from sklearn.impute import SimpleImputer
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    from sklearn.linear_model import LogisticRegression, LinearRegression
    from sklearn.metrics import accuracy_score, mean_squared_error, r2_score, f1_score, confusion_matrix
except ImportError:
    pass

router = APIRouter()

from app.core.rate_limit import limiter
class TrainRequest(BaseModel):
    model_name: str
    target_column: str
    feature_columns: List[str]
    algorithm: str # e.g., "RANDOM_FOREST_REGRESSOR", "RANDOM_FOREST_CLASSIFIER", "LINEAR_REGRESSION", "LOGISTIC_REGRESSION"
    parameters: Dict[str, Any] = {}

@router.post("/{dataset_id}/train")
@limiter.limit("5/minute")
async def train_model(request: Request, dataset_id: str, train_req: TrainRequest, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch current dataset and active version
    d_res = supabase.table("datasets").select("active_version_id").eq("id", dataset_id).single().execute()
    active_version_id = d_res.data.get("active_version_id")
    
    # 2. Fetch records matching active_version_id in batches to bypass PostgREST limits
    records = []
    chunk_size = 10000
    current_offset = 0
    
    while True:
        query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).order("id").range(current_offset, current_offset + chunk_size - 1)
        if active_version_id:
            query = query.eq("version_id", active_version_id)
        else:
            query = query.is_("version_id", "null")
            
        response = query.execute()
        fetched = response.data
        
        if not fetched:
            break
            
        records.extend(fetched)
        
        if len(fetched) < chunk_size:
            break
            
        current_offset += chunk_size
    
    if not records:
        raise HTTPException(status_code=400, detail="Dataset is empty.")
        
    df = pd.DataFrame([r["data"] for r in records])
    
    # 2. Validate columns
    if train_req.target_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{train_req.target_column}' not found.")
        
    for col in train_req.feature_columns:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Feature column '{col}' not found.")
            
    # Fetch dataset columns definitions to get semantic types
    cols_query = supabase.table("dataset_columns").select("*").eq("dataset_id", dataset_id).execute()
    col_defs = {c["column_name"]: c for c in cols_query.data}
    
    df = df.dropna(subset=[train_req.target_column])
    X = df[train_req.feature_columns].copy()
    y = df[train_req.target_column].copy()
    
    try:
        transformers = []
        feature_names_mapping = {}
        
        for i, col in enumerate(train_req.feature_columns):
            col_def = col_defs.get(col, {})
            semantic_type = col_def.get("semantic_type", "UNKNOWN")
            encoding = col_def.get("encoding_type", "NONE")
            
            if semantic_type in ["INTEGER", "DECIMAL"] or pd.api.types.is_numeric_dtype(X[col]):
                X[col] = pd.to_numeric(X[col], errors='coerce')
                transformers.append((
                    f"num_{i}", 
                    Pipeline([
                        ('imputer', SimpleImputer(strategy='mean')),
                        ('scaler', StandardScaler())
                    ]), 
                    [col]
                ))
            elif semantic_type in ["CATEGORY", "SINGLE_CHOICE"]:
                X[col] = X[col].astype(str)
                transformers.append((
                    f"cat_{i}", 
                    Pipeline([
                        ('imputer', SimpleImputer(strategy='constant', fill_value='Missing')),
                        ('encoder', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
                    ]), 
                    [col]
                ))
            elif semantic_type in ["SHORT_TEXT", "LONG_TEXT"]:
                X[col] = X[col].fillna("").astype(str)
                transformers.append((
                    f"txt_{i}", 
                    TfidfVectorizer(max_features=1000, stop_words='english'), 
                    col
                ))
            else:
                # Default fallback
                X[col] = X[col].astype(str)
                transformers.append((
                    f"cat_default_{i}", 
                    Pipeline([
                        ('imputer', SimpleImputer(strategy='constant', fill_value='Missing')),
                        ('encoder', OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1))
                    ]), 
                    [col]
                ))
                
        preprocessor = ColumnTransformer(transformers=transformers, remainder='drop')
                
        # Encode target if classification
        is_classification = "CLASSIFIER" in train_req.algorithm or "LOGISTIC" in train_req.algorithm
        if is_classification and (y.dtype == 'object' or y.dtype.name == 'category'):
            le_y = LabelEncoder()
            y = le_y.fit_transform(y.astype(str))
        elif not is_classification:
            try:
                y = pd.to_numeric(y)
            except Exception:
                raise HTTPException(status_code=400, detail="You selected a Regression algorithm, but your Target Variable contains text categories. Please change your algorithm to Classification (e.g. Random Forest Classifier), or choose a numeric Target Variable.")
            
        # 5. Initialize model based on algorithm
        model = None
        task_type = "classification"
        
        if train_req.algorithm == "RANDOM_FOREST_CLASSIFIER":
            model = RandomForestClassifier(**train_req.parameters)
            task_type = "classification"
        elif train_req.algorithm == "RANDOM_FOREST_REGRESSOR":
            model = RandomForestRegressor(**train_req.parameters)
            task_type = "regression"
        elif train_req.algorithm == "LINEAR_REGRESSION":
            model = LinearRegression(**train_req.parameters)
            task_type = "regression"
        elif train_req.algorithm == "LOGISTIC_REGRESSION":
            model = LogisticRegression(max_iter=1000, **train_req.parameters)
            task_type = "classification"
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported algorithm '{train_req.algorithm}'")
            
        # Create full pipeline
        clf = Pipeline(steps=[('preprocessor', preprocessor),
                              ('classifier', model)])
                              
        # Split
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        clf.fit(X_train, y_train)
        y_pred = clf.predict(X_test)
        
        # 5. Metrics & Feature Importances
        metrics = {}
        if is_classification:
            metrics["accuracy"] = accuracy_score(y_test, y_pred)
            metrics["f1_score"] = f1_score(y_test, y_pred, average='weighted')
            try:
                metrics["confusion_matrix"] = confusion_matrix(y_test, y_pred).tolist()
            except:
                pass
        else:
            metrics["mse"] = mean_squared_error(y_test, y_pred)
            metrics["r2"] = r2_score(y_test, y_pred)
            
        # Clean metrics for JSON serialization
        for k, v in metrics.items():
            if k == "confusion_matrix": continue
            v_float = float(v)
            if math.isnan(v_float):
                metrics[k] = None
            else:
                metrics[k] = v_float
                
        feature_importances = {}
        # Try to extract feature names if possible (complex with ColumnTransformer in older sklearn)
        try:
            feat_names = clf.named_steps['preprocessor'].get_feature_names_out()
        except:
            feat_names = [f"Feature_{i}" for i in range(len(train_req.feature_columns))]
            
        actual_model = clf.named_steps['classifier']
        
        if hasattr(actual_model, 'feature_importances_'):
            importances = actual_model.feature_importances_
            for i, name in enumerate(feat_names):
                if i < len(importances):
                    val = float(importances[i])
                    feature_importances[name] = 0.0 if math.isnan(val) else val
        elif hasattr(actual_model, 'coef_'):
            importances = actual_model.coef_[0] if len(actual_model.coef_.shape) > 1 else actual_model.coef_
            for i, name in enumerate(feat_names):
                if i < len(importances):
                    val = float(abs(importances[i]))
                    feature_importances[name] = 0.0 if math.isnan(val) else val
                
        # Normalize feature importances to sum to 1 for percentage display
        total_importance = sum(feature_importances.values())
        if total_importance > 0:
            for col in feature_importances:
                feature_importances[col] = feature_importances[col] / total_importance
                
        # Sort feature importances
        feature_importances = dict(sorted(feature_importances.items(), key=lambda item: item[1], reverse=True))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Model training failed: {str(e)}. Please check if your dataset is compatible with this algorithm.")

    # 9. Save experiment record
    experiment_data = {
        "dataset_id": dataset_id,
        "model_name": f"{train_req.algorithm} - {train_req.target_column}",
        "target_column": train_req.target_column,
        "feature_columns": train_req.feature_columns,
        "algorithm": train_req.algorithm,
        "metrics": metrics,
        "feature_importances": feature_importances,
        "status": "completed"
    }
    
    return experiment_data

@router.get("/{dataset_id}/models")
async def get_models(dataset_id: str, supabase: Client = Depends(get_supabase_client)):
    try:
        res = supabase.table("ml_experiments").select("*").eq("dataset_id", dataset_id).order("created_at", desc=True).execute()
        return res.data
    except Exception as e:
        print(f"Error fetching models: {e}")
        return []
