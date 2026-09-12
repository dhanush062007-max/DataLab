from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from app.core.supabase import get_supabase_client
import pandas as pd
from app.services.semantic_engine import SemanticTypeEngine, ColumnSemanticType

router = APIRouter()

@router.post("/{dataset_id}/profile")
def profile_dataset(dataset_id: str, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch columns to know what to profile
    cols_resp = supabase.table("dataset_columns").select("*").eq("dataset_id", dataset_id).execute()
    if not cols_resp.data:
        raise HTTPException(status_code=404, detail="No columns found for dataset")
        
    columns = cols_resp.data

    # 2. Fetch a sample of records (up to 10,000 for profiling)
    records_resp = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).limit(10000).execute()
    if not records_resp.data:
        raise HTTPException(status_code=400, detail="No records found in dataset to profile")

    # 3. Convert to Pandas DataFrame
    df = pd.DataFrame([r["data"] for r in records_resp.data])

    # 4. Profile each column
    updates = []
    for col in columns:
        col_name = col["column_name"]
        
        # Only auto-detect if UNKNOWN or user requested (we assume we can overwrite if requested, or just UNKNOWNs for now)
        # To be safe and follow requirement "initially allow semantic type = Unknown/Text, run automatic type detection afterward"
        if col_name in df.columns and col.get("semantic_type") == "UNKNOWN":
            sem_type, meta = SemanticTypeEngine.detect_semantic_type(df[col_name], col_name)
            
            # If high confidence or we just want to apply our best guess:
            if meta.get("confidence", 0) > 0.6 and sem_type != ColumnSemanticType.UNKNOWN:
                ml_role, encoding = SemanticTypeEngine.get_ml_recommendations(sem_type)
                
                update_payload = {
                    "semantic_type": sem_type.value,
                    "ml_role": ml_role.value,
                    "encoding_type": encoding.value
                }
                
                # If it's a choice type, extract options
                if sem_type in [ColumnSemanticType.CATEGORY, ColumnSemanticType.SINGLE_CHOICE, ColumnSemanticType.MULTIPLE_CHOICE]:
                    # Extract unique values up to a reasonable limit (e.g. 50)
                    if sem_type == ColumnSemanticType.MULTIPLE_CHOICE:
                        # Split commas/pipes and get unique
                        all_vals = df[col_name].dropna().astype(str).str.split(r'[,|;]').explode().str.strip()
                        unique_options = all_vals.unique().tolist()
                    else:
                        unique_options = df[col_name].dropna().astype(str).unique().tolist()
                        
                    if len(unique_options) <= 50:
                        update_payload["options"] = unique_options
                        
                updates.append((col["id"], update_payload))

    # 5. Save updates to database
    for col_id, payload in updates:
        supabase.table("dataset_columns").update(payload).eq("id", col_id).execute()
        
    return {"status": "success", "profiled_columns": len(updates)}
