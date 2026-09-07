from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from app.core.supabase import get_supabase_client
import pandas as pd

router = APIRouter()

@router.get("/{dataset_id}/eda")
async def get_exploratory_data_analysis(dataset_id: str, supabase: Client = Depends(get_supabase_client)):
    
    query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id)
        
    response = query.execute()
    records = response.data
    

        
    if not records:
        return {"total_rows": 0, "columns": []}

    # 2. Convert JSONB into Pandas DataFrame
    # Each record looks like {"data": {"col1": "val1", ...}}
    df = pd.DataFrame([r["data"] for r in records])
    
    total_rows = len(df)
    
    # 3. Calculate dynamic statistics
    stats = []
    
    for col in df.columns:
        col_data = df[col]
        null_count = int(col_data.isnull().sum())
        
        col_stat = {
            "name": col,
            "type": str(col_data.dtype),
            "null_count": null_count,
            "null_percentage": round((null_count / total_rows) * 100, 2) if total_rows > 0 else 0,
        }
        
        # If numerical, calculate numerical stats
        if pd.api.types.is_numeric_dtype(col_data):
            col_stat["is_numeric"] = True
            col_stat["mean"] = float(col_data.mean()) if not pd.isna(col_data.mean()) else None
            col_stat["median"] = float(col_data.median()) if not pd.isna(col_data.median()) else None
            col_stat["min"] = float(col_data.min()) if not pd.isna(col_data.min()) else None
            col_stat["max"] = float(col_data.max()) if not pd.isna(col_data.max()) else None
            col_stat["std"] = float(col_data.std()) if not pd.isna(col_data.std()) else None
        else:
            col_stat["is_numeric"] = False
            # Get top 5 most common categories
            value_counts = col_data.value_counts().head(5)
            col_stat["top_categories"] = [
                {"name": str(k), "count": int(v)} for k, v in value_counts.items()
            ]
            
        stats.append(col_stat)
        
    return {
        "total_rows": total_rows,
        "columns": stats
    }

@router.get("/{dataset_id}/debug")
async def debug_records(dataset_id: str, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch datasets to see if RLS allows us
    d_res = supabase.table("datasets").select("*").eq("id", dataset_id).execute()
    
    # 2. Fetch records
    r_res = supabase.table("dataset_records").select("id").eq("dataset_id", dataset_id).execute()
    
    return {
        "datasets_found": len(d_res.data) if d_res.data else 0,
        "records_found": len(r_res.data) if r_res.data else 0,
        "dataset_data": d_res.data,
        "records_data": r_res.data
    }
