import os
import sys
import pandas as pd

# Adjust path to import from app
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from supabase import create_client, Client
from app.services.nlp.type_inference import infer_semantic_type

def migrate_existing_datasets():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Missing SUPABASE_URL or SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY")
        return
        
    supabase: Client = create_client(supabase_url, supabase_key)
    
    print("Fetching existing datasets...")
    datasets_resp = supabase.table("datasets").select("id").execute()
    
    for dataset in datasets_resp.data:
        dataset_id = dataset["id"]
        print(f"Processing dataset {dataset_id}...")
        
        # Get columns
        columns_resp = supabase.table("dataset_columns").select("*").eq("dataset_id", dataset_id).execute()
        columns = columns_resp.data
        
        if not columns:
            continue
            
        # Get records (limit to 1000 for inference to save memory)
        records_resp = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).limit(1000).execute()
        records = records_resp.data
        
        if not records:
            continue
            
        df = pd.DataFrame([r["data"] for r in records])
        
        for col in columns:
            col_name = col["column_name"]
            if col_name not in df.columns:
                continue
                
            # Run inference
            inference = infer_semantic_type(df[col_name])
            
            # Update only if high confidence (> 80), otherwise UNKNOWN
            semantic_type = inference["semantic_type"] if inference["confidence"] >= 80 else "UNKNOWN"
            ml_role = inference["ml_role"] if inference["confidence"] >= 80 else "IGNORE"
            encoding_type = inference["encoding_type"] if inference["confidence"] >= 80 else "NONE"
            
            print(f"  Column '{col_name}' -> {semantic_type} (Conf: {inference['confidence']}%)")
            
            # Update the column in the database
            supabase.table("dataset_columns").update({
                "semantic_type": semantic_type,
                "ml_role": ml_role,
                "encoding_type": encoding_type
            }).eq("id", col["id"]).execute()

if __name__ == "__main__":
    migrate_existing_datasets()
