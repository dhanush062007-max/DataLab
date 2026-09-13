from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import requests
import zipfile
import io
import math
from app.core.supabase import get_supabase_client
from supabase import Client

router = APIRouter()

class ImportRequest(BaseModel):
    url: str
    kaggle_username: Optional[str] = None
    kaggle_key: Optional[str] = None

@router.post("/{dataset_id}/import-url")
def import_dataset_from_url(
    dataset_id: str, 
    req: ImportRequest, 
    supabase: Client = Depends(get_supabase_client)
):
    try:
        # 1. Verify Dataset Ownership
        ds_res = supabase.table("datasets").select("owner_id, column_metadata, name").eq("id", dataset_id).single().execute()
        if not ds_res.data:
            raise HTTPException(status_code=404, detail="Dataset not found")
            
        dataset = ds_res.data
        column_metadata = dataset.get("column_metadata", [])

        # 2. Download and Parse Data
        try:
            if req.kaggle_username and req.kaggle_key:
                # Kaggle Dataset Download (expects url to be 'owner/dataset' e.g. 'zillow/zecon')
                dataset_ref = req.url.replace("https://www.kaggle.com/datasets/", "").strip("/")
                api_url = f"https://www.kaggle.com/api/v1/datasets/download/{dataset_ref}"
                
                resp = requests.get(api_url, auth=(req.kaggle_username, req.kaggle_key), stream=True)
                if resp.status_code != 200:
                    raise Exception(f"Kaggle API Error: {resp.status_code} - {resp.text}")
                
                # Kaggle always returns a zip file
                with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
                    csv_filename = next((name for name in z.namelist() if name.endswith('.csv')), None)
                    if not csv_filename:
                        raise Exception("No CSV file found in the Kaggle dataset zip.")
                    with z.open(csv_filename) as f:
                        df = pd.read_csv(f)
            else:
                # Direct URL CSV Download
                df = pd.read_csv(req.url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch or parse dataset: {str(e)}")

        if df.empty:
            raise HTTPException(status_code=400, detail="The downloaded dataset is empty.")

        # 3. Clean and map columns based on schema
        # (similar to manual CSV upload logic, we just take the columns that exist in metadata)
        expected_cols = [c["column_name"] for c in column_metadata]
        df.columns = df.columns.str.strip() # Strip whitespace from headers
        
        # Keep only columns that are defined in schema, or all if schema is flexible
        # For DataLab, we enforce the schema.
        missing_required = []
        for col in column_metadata:
            if col["required"] and col["column_name"] not in df.columns:
                missing_required.append(col["column_name"])
                
        if missing_required:
            raise HTTPException(status_code=400, detail=f"Missing required columns in imported data: {', '.join(missing_required)}")

        # Filter df to only schema columns that exist
        valid_cols = [c for c in expected_cols if c in df.columns]
        df = df[valid_cols]

        # Convert NaN to None for JSON serialization
        df = df.replace({float('nan'): None})

        # 4. Insert into database in chunks
        records = df.to_dict(orient="records")
        chunk_size = 500
        
        for i in range(0, len(records), chunk_size):
            chunk = records[i:i + chunk_size]
            payload = [{"dataset_id": dataset_id, "data": row, "version_id": None} for row in chunk]
            supabase.table("dataset_records").insert(payload).execute()

        # Update dataset row count
        row_count = len(records)
        supabase.table("datasets").update({"row_count": row_count}).eq("id", dataset_id).execute()

        # 5. Create initial version history record
        v_res = supabase.table("dataset_versions").insert({
            "dataset_id": dataset_id,
            "operation": "Initial API Import",
            "parameters": {"source": "Kaggle" if req.kaggle_username else "Direct URL", "url": req.url},
            "created_by": dataset["owner_id"]
        }).execute()
        
        version_id = v_res.data[0]["id"] if v_res.data else None
        
        if version_id:
            supabase.table("datasets").update({"active_version_id": version_id}).eq("id", dataset_id).execute()
            # Link records to this version
            supabase.table("dataset_records").update({"version_id": version_id}).eq("dataset_id", dataset_id).is_("version_id", "null").execute()

        return {"message": "Successfully imported dataset", "rows_imported": row_count}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error importing dataset: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
