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
from sklearn.linear_model import SGDClassifier, SGDRegressor
from sklearn.feature_extraction import FeatureHasher
from sklearn.metrics import accuracy_score, f1_score, mean_squared_error, r2_score
import numpy as np
import traceback

class TrainRequest(BaseModel):
    model_name: str
    target_column: str
    feature_columns: List[str]
    algorithm: str # e.g., "RANDOM_FOREST_REGRESSOR", "RANDOM_FOREST_CLASSIFIER", "LINEAR_REGRESSION", "LOGISTIC_REGRESSION"
    parameters: Dict[str, Any] = {}

@router.post("/{dataset_id}/train")
@limiter.limit("5/minute")
def train_model(request: Request, dataset_id: str, train_req: TrainRequest, supabase: Client = Depends(get_supabase_client)):
    try:
        # 1. Fetch active version
        d_res = supabase.table("datasets").select("active_version_id").eq("id", dataset_id).single().execute()
        active_version_id = d_res.data.get("active_version_id") if d_res.data else None
        
        is_classification = "CLASSIFIER" in train_req.algorithm or "LOGISTIC" in train_req.algorithm
        
        chunk_size = 1000
        
        # 2. For classification, we must find all unique classes first
        all_classes = set()
        if is_classification:
            current_offset = 0
            while True:
                query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).order("id").range(current_offset, current_offset + chunk_size - 1)
                if active_version_id:
                    query = query.eq("version_id", active_version_id)
                else:
                    query = query.is_("version_id", "null")
                    
                res = query.execute()
                if not res.data:
                    break
                for r in res.data:
                    val = r["data"].get(train_req.target_column)
                    if val is not None and str(val).strip() != "":
                        all_classes.add(str(val))
                if len(res.data) < chunk_size:
                    break
                current_offset += chunk_size
                
            all_classes = list(all_classes)
            if not all_classes:
                raise HTTPException(status_code=400, detail="Target column has no valid data.")

        # 3. Initialize Out-Of-Core Model & Hasher
        if train_req.algorithm in ["RANDOM_FOREST_CLASSIFIER", "LOGISTIC_REGRESSION"]:
            model = SGDClassifier(loss='log_loss', random_state=42)
        elif train_req.algorithm in ["RANDOM_FOREST_REGRESSOR", "LINEAR_REGRESSION"]:
            model = SGDRegressor(random_state=42)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported algorithm '{train_req.algorithm}'")
            
        hasher = FeatureHasher(n_features=10000) # Large enough to avoid collisions
        
        # We will hold out the first chunk as a test set for metrics
        test_X_dicts = []
        test_y_vals = []
        
        current_offset = 0
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
                
            X_dicts = []
            y_vals = []
            
            for r in fetched:
                row = r["data"]
                target_val = row.get(train_req.target_column)
                if target_val is None or str(target_val).strip() == "":
                    continue
                    
                x_dict = {}
                for col in train_req.feature_columns:
                    val = row.get(col)
                    if val is not None:
                        # FeatureHasher: if val is string it counts as category, if numeric it's value
                        if isinstance(val, (int, float)):
                            x_dict[col] = float(val)
                        else:
                            x_dict[f"{col}={str(val)}"] = 1.0
                            
                X_dicts.append(x_dict)
                
                if is_classification:
                    y_vals.append(str(target_val))
                else:
                    try:
                        y_vals.append(float(target_val))
                    except (ValueError, TypeError):
                        y_vals.append(0.0)
                        
            if not X_dicts:
                if len(fetched) < chunk_size:
                    break
                current_offset += chunk_size
                continue
                
            # If this is the first chunk, let's save it as the test set
            if current_offset == 0:
                test_X_dicts = X_dicts
                test_y_vals = y_vals
            else:
                X_chunk = hasher.transform(X_dicts)
                if is_classification:
                    model.partial_fit(X_chunk, y_vals, classes=all_classes)
                else:
                    model.partial_fit(X_chunk, y_vals)
                    
            if len(fetched) < chunk_size:
                break
                
            current_offset += chunk_size
            
        # If the dataset was so small it only had 1 chunk, we must train and test on the same chunk
        if not hasattr(model, 'coef_'):
            if test_X_dicts:
                X_chunk = hasher.transform(test_X_dicts)
                if is_classification:
                    model.partial_fit(X_chunk, test_y_vals, classes=all_classes)
                else:
                    model.partial_fit(X_chunk, test_y_vals)
            else:
                raise HTTPException(status_code=400, detail="Not enough valid data to train.")
                
        # 4. Metrics
        metrics = {}
        if test_X_dicts:
            X_test = hasher.transform(test_X_dicts)
            y_pred = model.predict(X_test)
            
            if is_classification:
                metrics["accuracy"] = float(accuracy_score(test_y_vals, y_pred))
                metrics["f1_score"] = float(f1_score(test_y_vals, y_pred, average='weighted', zero_division=0))
            else:
                metrics["mse"] = float(mean_squared_error(test_y_vals, y_pred))
                metrics["r2"] = float(r2_score(test_y_vals, y_pred))
                
        # Clean metrics
        for k, v in metrics.items():
            if math.isnan(v):
                metrics[k] = None
                
        # Feature Importances (Not available for Hashed features)
        feature_importances = {"Feature Hashing (Out-Of-Core)": 1.0}
        
        experiment_data = {
            "dataset_id": dataset_id,
            "model_name": f"{train_req.algorithm} (Streaming) - {train_req.target_column}",
            "target_column": train_req.target_column,
            "feature_columns": train_req.feature_columns,
            "algorithm": train_req.algorithm,
            "metrics": metrics,
            "feature_importances": feature_importances,
            "status": "completed"
        }
        
        return experiment_data

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Model training failed: {str(e)}.")

@router.get("/{dataset_id}/models")
def get_models(dataset_id: str, supabase: Client = Depends(get_supabase_client)):
    try:
        res = supabase.table("ml_experiments").select("*").eq("dataset_id", dataset_id).order("created_at", desc=True).execute()
        return res.data
    except Exception as e:
        print(f"Error fetching models: {e}")
        return []
