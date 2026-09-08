from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from app.core.supabase import get_supabase_client
import pandas as pd
import json

router = APIRouter()

@router.get("/{dataset_id}/eda")
async def get_exploratory_data_analysis(dataset_id: str, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch records
    query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id)
    response = query.execute()
    records = response.data
    
    if not records:
        return {"total_rows": 0, "columns": []}

    # 2. Convert JSONB into Pandas DataFrame
    df = pd.DataFrame([r["data"] for r in records])
    total_rows = len(df)
    
    # 3. Fetch Column Semantic Types
    cols_resp = supabase.table("dataset_columns").select("column_name, semantic_type, display_name, data_type").eq("dataset_id", dataset_id).execute()
    col_types = {c["column_name"]: c for c in cols_resp.data}
    
    # 4. Calculate dynamic statistics based on Semantic Type
    stats = []
    
    for col in df.columns:
        col_data = df[col]
        null_count = int(col_data.isnull().sum())
        col_info = col_types.get(col, {})
        semantic_type = col_info.get("semantic_type", "UNKNOWN")
        data_type = col_info.get("data_type", str(col_data.dtype))
        
        col_stat = {
            "name": col,
            "type": str(col_data.dtype),
            "data_type": data_type,
            "semantic_type": semantic_type,
            "null_count": null_count,
            "null_percentage": round((null_count / total_rows) * 100, 2) if total_rows > 0 else 0,
        }
        
        # Treat as Numeric only if semantic type implies it
        is_numeric_semantic = semantic_type in ["INTEGER", "DECIMAL"]
        
        if is_numeric_semantic and pd.api.types.is_numeric_dtype(col_data):
            col_stat["is_numeric"] = True
            col_stat["mean"] = float(col_data.mean()) if not pd.isna(col_data.mean()) else None
            col_stat["median"] = float(col_data.median()) if not pd.isna(col_data.median()) else None
            col_stat["min"] = float(col_data.min()) if not pd.isna(col_data.min()) else None
            col_stat["max"] = float(col_data.max()) if not pd.isna(col_data.max()) else None
            col_stat["std"] = float(col_data.std()) if not pd.isna(col_data.std()) else None
        
        elif semantic_type in ["MULTIPLE_CHOICE", "TAGS"]:
            col_stat["is_numeric"] = False
            # Break down comma separated strings
            all_tags = []
            for val in col_data.dropna():
                if isinstance(val, list):
                    all_tags.extend(val)
                elif isinstance(val, str):
                    all_tags.extend([x.strip() for x in val.split(',')])
            tag_series = pd.Series(all_tags)
            value_counts = tag_series.value_counts().head(10)
            col_stat["top_categories"] = [
                {"name": str(k), "count": int(v)} for k, v in value_counts.items()
            ]
            
        elif semantic_type in ["SHORT_TEXT", "LONG_TEXT"]:
            col_stat["is_numeric"] = False
            # Text specific stats
            str_data = col_data.dropna().astype(str)
            if len(str_data) > 0:
                col_stat["avg_length"] = float(str_data.str.len().mean())
                col_stat["avg_words"] = float(str_data.str.split().apply(len).mean())
                
        else:
            # Fallback for CATEGORY, SINGLE_CHOICE, ORDINAL_CHOICE, BOOLEAN, etc.
            col_stat["is_numeric"] = False
            value_counts = col_data.value_counts().head(10)
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
    d_res = supabase.table("datasets").select("*").eq("id", dataset_id).execute()
    r_res = supabase.table("dataset_records").select("id").eq("dataset_id", dataset_id).execute()
    return {
        "datasets_found": len(d_res.data) if d_res.data else 0,
        "records_found": len(r_res.data) if r_res.data else 0,
        "dataset_data": d_res.data,
        "records_data": r_res.data
    }
