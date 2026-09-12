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

from app.services.ml_engine import MLEngine

class TrainRequest(BaseModel):
    model_name: str
    target_column: str
    feature_columns: List[str]
    algorithm: str # "RANDOM_FOREST" or "LINEAR_MODEL"
    parameters: Dict[str, Any] = {}

@router.post("/{dataset_id}/train")
@limiter.limit("5/minute")
def train_model(request: Request, dataset_id: str, train_req: TrainRequest, supabase: Client = Depends(get_supabase_client)):
    try:
        # 1. Fetch active version & column metadata
        d_res = supabase.table("datasets").select("active_version_id").eq("id", dataset_id).single().execute()
        active_version_id = d_res.data.get("active_version_id") if d_res.data else None
        
        c_res = supabase.table("dataset_columns").select("*").eq("dataset_id", dataset_id).execute()
        column_metadata = c_res.data or []
        
        # 2. Fetch Sampled Data (up to 10k rows for AutoML Lite)
        query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).limit(10000)
        if active_version_id:
            query = query.eq("version_id", active_version_id)
        else:
            query = query.is_("version_id", "null")
            
        r_res = query.execute()
        if not r_res.data:
            raise HTTPException(status_code=400, detail="No data available for training.")
            
        df = pd.DataFrame([r["data"] for r in r_res.data])
        
        # 3. Train via MLEngine
        experiment_data = MLEngine.train_model(
            dataset_id=dataset_id,
            target_column=train_req.target_column,
            feature_columns=train_req.feature_columns,
            base_algorithm=train_req.algorithm,
            df=df,
            column_metadata=column_metadata
        )
        
        return experiment_data

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Model training failed: {str(e)}.")

@router.get("/{dataset_id}/models")
def get_models(dataset_id: str, supabase: Client = Depends(get_supabase_client)):
    try:
        res = supabase.table("ml_experiments").select("*").eq("dataset_id", dataset_id).order("created_at", desc=True).execute()
        return res.data
    except Exception as e:
        print(f"Error fetching models: {e}")
        return []
