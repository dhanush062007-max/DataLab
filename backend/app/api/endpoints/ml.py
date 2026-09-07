from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from supabase import Client
from app.core.supabase import get_supabase_client
import pandas as pd
import json
import math

try:
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    from sklearn.linear_model import LogisticRegression, LinearRegression
    from sklearn.metrics import accuracy_score, mean_squared_error, r2_score, f1_score, confusion_matrix
except ImportError:
    pass

router = APIRouter()

class TrainRequest(BaseModel):
    model_name: str
    target_column: str
    feature_columns: List[str]
    algorithm: str # e.g., "RANDOM_FOREST_REGRESSOR", "RANDOM_FOREST_CLASSIFIER", "LINEAR_REGRESSION", "LOGISTIC_REGRESSION"
    parameters: Dict[str, Any] = {}

@router.post("/{dataset_id}/train")
async def train_model(dataset_id: str, request: TrainRequest, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch current dataset records
    query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id)
    response = query.execute()
    records = response.data
    
    if not records:
        raise HTTPException(status_code=400, detail="Dataset is empty.")
        
    df = pd.DataFrame([r["data"] for r in records])
    
    # 2. Validate columns
    if request.target_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{request.target_column}' not found.")
        
    for col in request.feature_columns:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Feature column '{col}' not found.")
            
    # 3. Preprocessing (Drop missing target rows, simple imputation for features)
    df = df.dropna(subset=[request.target_column])
    X = df[request.feature_columns].copy()
    y = df[request.target_column].copy()
    
    try:
        # Simple label encoding for string columns
        label_encoders = {}
        for col in X.columns:
            if pd.api.types.is_numeric_dtype(X[col]):
                X[col] = X[col].fillna(X[col].mean())
            else:
                X[col] = X[col].fillna('Missing')
                le = LabelEncoder()
                X[col] = le.fit_transform(X[col].astype(str))
                
        # Encode target if classification
        is_classification = "CLASSIFIER" in request.algorithm or "LOGISTIC" in request.algorithm
        if is_classification and (y.dtype == 'object' or y.dtype.name == 'category'):
            le_y = LabelEncoder()
            y = le_y.fit_transform(y.astype(str))
            
        # Split
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # 4. Train
        if request.algorithm == "RANDOM_FOREST_CLASSIFIER":
            model = RandomForestClassifier(random_state=42)
        elif request.algorithm == "RANDOM_FOREST_REGRESSOR":
            model = RandomForestRegressor(random_state=42)
        elif request.algorithm == "LINEAR_REGRESSION":
            model = LinearRegression()
        elif request.algorithm == "LOGISTIC_REGRESSION":
            model = LogisticRegression(max_iter=1000)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported algorithm: {request.algorithm}")
            
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        
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
        if hasattr(model, 'feature_importances_'):
            importances = model.feature_importances_
            for i, col in enumerate(X.columns):
                val = float(importances[i])
                feature_importances[col] = 0.0 if math.isnan(val) else val
        elif hasattr(model, 'coef_'):
            importances = model.coef_[0] if len(model.coef_.shape) > 1 else model.coef_
            for i, col in enumerate(X.columns):
                val = float(abs(importances[i]))
                feature_importances[col] = 0.0 if math.isnan(val) else val
                
        # Normalize feature importances to sum to 1 for percentage display
        total_importance = sum(feature_importances.values())
        if total_importance > 0:
            for col in feature_importances:
                feature_importances[col] = feature_importances[col] / total_importance
                
        # Sort feature importances
        feature_importances = dict(sorted(feature_importances.items(), key=lambda item: item[1], reverse=True))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Model training failed: {str(e)}. Please check if your dataset is compatible with this algorithm.")


    # 6. Return computed data (Frontend will save to DB)
    experiment_data = {
        "dataset_id": dataset_id,
        "model_name": request.model_name,
        "algorithm": request.algorithm,
        "target_column": request.target_column,
        "feature_columns": request.feature_columns,
        "metrics": metrics,
        "feature_importances": feature_importances,
        "status": "COMPLETED"
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
