from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Any, Dict
from supabase import Client
from app.core.supabase import get_supabase_client
import pandas as pd
from app.services.data_quality import DataQualityEngine

router = APIRouter()

class CleanRequest(BaseModel):
    operation: str
    parameters: Dict[str, Any] = {}

@router.get("/{dataset_id}/quality")
def get_dataset_quality(dataset_id: str, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch current dataset records
    d_res = supabase.table("datasets").select("active_version_id", "row_count").eq("id", dataset_id).single().execute()
    if not d_res.data:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    active_version_id = d_res.data.get("active_version_id")
    
    # 2. Fetch columns
    cols_res = supabase.table("dataset_columns").select("*").eq("dataset_id", dataset_id).execute()
    column_metadata = cols_res.data or []
    
    # 3. Fetch sample of records to evaluate (up to 5000 for speed)
    query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).limit(5000)
    if active_version_id:
        query = query.eq("version_id", active_version_id)
    else:
        query = query.is_("version_id", "null")
        
    records_res = query.execute()
    
    if not records_res.data:
        return {"score": 0, "warnings": ["Dataset is empty"], "breakdown": {}}
        
    df = pd.DataFrame([r["data"] for r in records_res.data])
    
    # 4. Compute quality score
    quality_report = DataQualityEngine.compute_quality_score(df, column_metadata)
    
    # 5. Get smart suggestions
    suggestions = {}
    for col in column_metadata:
        if col["column_name"] in df.columns:
            sugg = DataQualityEngine.get_cleaning_suggestions(df, col["column_name"])
            if sugg["suggestions"]:
                suggestions[col["column_name"]] = sugg["suggestions"]
                
    quality_report["cleaning_suggestions"] = suggestions
    
    return quality_report

@router.post("/{dataset_id}/clean")
def clean_dataset(dataset_id: str, request: CleanRequest, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch current dataset
    d_res = supabase.table("datasets").select("active_version_id", "row_count").eq("id", dataset_id).single().execute()
    active_version_id = d_res.data.get("active_version_id")
    
    # 2. Create a new version record BEFORE streaming inserts
    version_res = supabase.table("dataset_versions").insert({
        "dataset_id": dataset_id,
        "operation": request.operation,
        "parameters": request.parameters,
        "source_version_id": active_version_id
    }).execute()
    
    new_version_id = version_res.data[0]["id"]
    
    chunk_size = 1000
    current_offset = 0
    total_processed = 0
    total_inserted = 0
    
    seen_hashes = set()
    global_mean = 0
    
    # PASS 1: If FILL_MEAN, we must calculate the global mean across all chunks first
    if request.operation == "FILL_MEAN":
        target_col = request.parameters.get("column")
        if not target_col:
            raise ValueError("Must specify a valid 'column' parameter.")
            
        sum_val = 0
        count_val = 0
        p1_offset = 0
        
        while True:
            query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).order("id").range(p1_offset, p1_offset + chunk_size - 1)
            if active_version_id:
                query = query.eq("version_id", active_version_id)
            else:
                query = query.is_("version_id", "null")
                
            res = query.execute()
            if not res.data:
                break
                
            for r in res.data:
                val = r["data"].get(target_col)
                if val is not None and isinstance(val, (int, float)):
                    sum_val += val
                    count_val += 1
            
            if len(res.data) < chunk_size:
                break
            p1_offset += chunk_size
            
        if count_val > 0:
            global_mean = sum_val / count_val

    # PASS 2: Stream chunks, process, and insert instantly
    insert_buffer = []
    
    def flush_buffer():
        nonlocal insert_buffer, total_inserted
        if not insert_buffer:
            return
        insert_chunk_size = 2000
        for i in range(0, len(insert_buffer), insert_chunk_size):
            supabase.table("dataset_records").insert(insert_buffer[i:i+insert_chunk_size]).execute()
        total_inserted += len(insert_buffer)
        insert_buffer = []

    try:
        while True:
            query = supabase.table("dataset_records").select("id, data").eq("dataset_id", dataset_id).order("id").range(current_offset, current_offset + chunk_size - 1)
            if active_version_id:
                query = query.eq("version_id", active_version_id)
            else:
                query = query.is_("version_id", "null")
                
            response = query.execute()
            fetched = response.data
            
            if not fetched:
                break
                
            df = pd.DataFrame([r["data"] for r in fetched])
            
            if request.operation == "DROP_NULLS":
                target_cols = request.parameters.get("columns", df.columns.tolist())
                existing_cols = [c for c in target_cols if c in df.columns]
                df_clean = df.dropna(subset=existing_cols) if existing_cols else df
                
            elif request.operation == "FILL_MEAN":
                target_col = request.parameters.get("column")
                df_clean = df.copy()
                if target_col in df_clean.columns:
                    df_clean[target_col] = df_clean[target_col].fillna(global_mean)
                    
            elif request.operation == "DROP_DUPLICATES":
                subset_cols = request.parameters.get("columns")
                
                keep_mask = []
                for idx, row in df.iterrows():
                    if subset_cols:
                        vals = tuple(str(row.get(col, None)) for col in subset_cols)
                    else:
                        sorted_keys = sorted(row.keys())
                        vals = tuple(str(row[k]) for k in sorted_keys)
                        
                    row_hash = hash(vals)
                    if row_hash in seen_hashes:
                        keep_mask.append(False)
                    else:
                        seen_hashes.add(row_hash)
                        keep_mask.append(True)
                        
                df_clean = df[keep_mask]
                
            elif request.operation == "NORMALIZE_TEXT":
                target_col = request.parameters.get("column")
                df_clean = df.copy()
                if target_col in df_clean.columns:
                    # Convert to string, lowercase, and strip
                    df_clean[target_col] = df_clean[target_col].astype(str).str.lower().str.strip()
                    # Replace "nan" or "none" strings back to None
                    df_clean[target_col] = df_clean[target_col].replace({'nan': None, 'none': None, '': None})
                    
            else:
                raise ValueError(f"Unknown operation: {request.operation}")
            
            # Queue for insertion
            df_clean = df_clean.where(pd.notnull(df_clean), None)
            for record_dict in df_clean.to_dict('records'):
                insert_buffer.append({
                    "dataset_id": dataset_id,
                    "data": record_dict,
                    "version_id": new_version_id
                })
                
            if len(insert_buffer) >= 2000:
                flush_buffer()
                
            total_processed += len(fetched)
            
            if len(fetched) < chunk_size:
                break
                
            current_offset += chunk_size
            
        flush_buffer()
        
    except Exception as e:
        supabase.table("dataset_versions").delete().eq("id", new_version_id).execute()
        raise HTTPException(status_code=400, detail=f"Cleaning failed: {str(e)}")
        
    if total_inserted == total_processed and request.operation != "FILL_MEAN":
        supabase.table("dataset_versions").delete().eq("id", new_version_id).execute()
        return {"message": "No changes made to dataset. No matching rows were found to remove.", "new_version_id": active_version_id}
        
    # 5. Update active version on dataset
    supabase.table("datasets").update({
        "active_version_id": new_version_id,
        "row_count": total_inserted
    }).eq("id", dataset_id).execute()
        
    rows_deleted = total_processed - total_inserted
    if request.operation == "DROP_DUPLICATES":
        success_msg = f"Successfully removed {rows_deleted} duplicate row{'s' if rows_deleted != 1 else ''}."
    elif request.operation == "DROP_NULLS":
        success_msg = f"Successfully removed {rows_deleted} row{'s' if rows_deleted != 1 else ''} with missing values."
    elif request.operation == "FILL_MEAN":
        success_msg = "Successfully filled missing values with the column mean."
    elif request.operation == "NORMALIZE_TEXT":
        success_msg = "Successfully normalized text (capitalization and spacing)."
    else:
        success_msg = "Dataset cleaned successfully."
        
    return {
        "message": success_msg,
        "new_version_id": new_version_id,
        "row_count": total_inserted
    }
