from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Any, Dict
from supabase import Client
from app.core.supabase import get_supabase_client
import pandas as pd

router = APIRouter()

class CleanRequest(BaseModel):
    operation: str
    parameters: Dict[str, Any] = {}

@router.post("/{dataset_id}/clean")
async def clean_dataset(dataset_id: str, request: CleanRequest, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch current dataset
    d_res = supabase.table("datasets").select("active_version_id").eq("id", dataset_id).single().execute()
    active_version_id = d_res.data.get("active_version_id")
    
    # Fetch records matching active_version_id in batches to avoid 1000 row limit
    records = []
    chunk_size = 10000
    current_offset = 0
    
    while True:
        query = supabase.table("dataset_records").select("id, data, version_id").eq("dataset_id", dataset_id).order("id").range(current_offset, current_offset + chunk_size - 1)
        # if active_version_id:
        #     query = query.eq("version_id", active_version_id)
        # else:
        #     query = query.is_("version_id", "null")
            
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
    
    # 2. Apply cleaning operation
    try:
        if request.operation == "DROP_NULLS":
            target_cols = request.parameters.get("columns", df.columns.tolist())
            df_clean = df.dropna(subset=target_cols)
        elif request.operation == "FILL_MEAN":
            target_col = request.parameters.get("column")
            if not target_col or target_col not in df.columns:
                raise ValueError("Must specify a valid 'column' parameter.")
            df_clean = df.copy()
            df_clean[target_col] = df_clean[target_col].fillna(df_clean[target_col].mean())
        elif request.operation == "DROP_DUPLICATES":
            subset_cols = request.parameters.get("columns")
            if subset_cols:
                df_clean = df.drop_duplicates(subset=subset_cols)
            else:
                df_clean = df.drop_duplicates()
        else:
            raise ValueError(f"Unknown operation: {request.operation}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cleaning failed: {str(e)}")
        
    if len(df_clean) == len(df) and request.operation != "FILL_MEAN":
        return {"message": "No changes made to dataset. No matching rows were found to remove.", "new_version_id": active_version_id}
        
    # 3. Create a new version record
    version_res = supabase.table("dataset_versions").insert({
        "dataset_id": dataset_id,
        "operation": request.operation,
        "parameters": request.parameters,
        "source_version_id": active_version_id
    }).execute()
    
    new_version_id = version_res.data[0]["id"]
    
    # 4. Insert new records for the new version
    records_to_insert = []
    df_clean = df_clean.where(pd.notnull(df_clean), None)
    
    for record_dict in df_clean.to_dict('records'):
        records_to_insert.append({
            "dataset_id": dataset_id,
            "data": record_dict,
            "version_id": new_version_id
        })
        
    chunk_size = 2000
    for i in range(0, len(records_to_insert), chunk_size):
        chunk = records_to_insert[i:i + chunk_size]
        supabase.table("dataset_records").insert(chunk).execute()
        
    # 5. Update active version on dataset
    supabase.table("datasets").update({
        "active_version_id": new_version_id,
        "row_count": len(df_clean)
    }).eq("id", dataset_id).execute()
        
    rows_deleted = len(df) - len(df_clean)
    if request.operation == "DROP_DUPLICATES":
        success_msg = f"Successfully removed {rows_deleted} duplicate row{'s' if rows_deleted != 1 else ''}."
    elif request.operation == "DROP_NULLS":
        success_msg = f"Successfully removed {rows_deleted} row{'s' if rows_deleted != 1 else ''} with missing values."
    elif request.operation == "FILL_MEAN":
        success_msg = "Successfully filled missing values with the column mean."
    else:
        success_msg = "Dataset cleaned successfully."
        
    return {
        "message": success_msg,
        "new_version_id": new_version_id,
        "row_count": len(df_clean)
    }
