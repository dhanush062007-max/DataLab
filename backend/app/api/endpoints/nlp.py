from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from app.core.supabase import get_supabase_client
import pandas as pd
from app.services.nlp_engine import NLPEngine

router = APIRouter()

@router.get("/{dataset_id}/nlp")
def get_nlp_analysis(dataset_id: str, column: str, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch current dataset records
    d_res = supabase.table("datasets").select("active_version_id", "row_count").eq("id", dataset_id).single().execute()
    if not d_res.data:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    active_version_id = d_res.data.get("active_version_id")
    
    # 2. Check if column exists and is a text type
    cols_res = supabase.table("dataset_columns").select("*").eq("dataset_id", dataset_id).eq("column_name", column).execute()
    if not cols_res.data:
        raise HTTPException(status_code=404, detail=f"Column {column} not found in dataset")
        
    col_meta = cols_res.data[0]
    if col_meta.get("semantic_type") not in ["LONG_TEXT", "SHORT_TEXT"] and col_meta.get("data_type") not in ["TEXT", "VARCHAR"]:
        raise HTTPException(status_code=400, detail=f"Column {column} is not a valid text column for NLP analysis.")
        
    # 3. Fetch records (limit to 5000 for synchronous processing)
    query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).limit(5000)
    if active_version_id:
        query = query.eq("version_id", active_version_id)
    else:
        query = query.is_("version_id", "null")
        
    records_res = query.execute()
    if not records_res.data:
        raise HTTPException(status_code=400, detail="Dataset is empty")
        
    df = pd.DataFrame([r["data"] for r in records_res.data])
    
    if column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column {column} has no data")
        
    # 4. Run Analysis
    try:
        report = NLPEngine.run_full_nlp_analysis(df, column)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
