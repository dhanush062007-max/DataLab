import os
import sys
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.semantic_engine import SemanticTypeEngine, ColumnSemanticType

load_dotenv()

def migrate_v1_datasets():
    url = os.getenv("SUPABASE_URL")
    # For a migration script we need service role key or at least anon key if RLS allows it
    # We will use anon key for now, assuming the user running this has RLS policies disabled or runs as superuser
    key = os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        print("Missing Supabase credentials in .env")
        return

    supabase: Client = create_client(url, key)

    print("Fetching all datasets...")
    datasets_resp = supabase.table("datasets").select("id, name").execute()
    datasets = datasets_resp.data

    if not datasets:
        print("No datasets found.")
        return

    print(f"Found {len(datasets)} datasets. Profiling them...")

    for dataset in datasets:
        dataset_id = dataset["id"]
        print(f"\nProcessing dataset: {dataset['name']} ({dataset_id})")
        
        # 1. Fetch columns
        cols_resp = supabase.table("dataset_columns").select("*").eq("dataset_id", dataset_id).execute()
        columns = cols_resp.data
        if not columns:
            print("  - No columns found, skipping.")
            continue
            
        # 2. Fetch records sample
        records_resp = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).limit(10000).execute()
        if not records_resp.data:
            print("  - No records found, skipping.")
            continue
            
        df = pd.DataFrame([r["data"] for r in records_resp.data])
        
        updates = []
        for col in columns:
            col_name = col["column_name"]
            
            # If the column is missing semantic_type or it's UNKNOWN
            if col_name in df.columns and col.get("semantic_type") in [None, "UNKNOWN"]:
                sem_type, meta = SemanticTypeEngine.detect_semantic_type(df[col_name], col_name)
                
                if meta.get("confidence", 0) > 0.6 and sem_type != ColumnSemanticType.UNKNOWN:
                    ml_role, encoding = SemanticTypeEngine.get_ml_recommendations(sem_type)
                    
                    update_payload = {
                        "semantic_type": sem_type.value,
                        "ml_role": ml_role.value,
                        "encoding_type": encoding.value
                    }
                    
                    if sem_type in [ColumnSemanticType.CATEGORY, ColumnSemanticType.SINGLE_CHOICE, ColumnSemanticType.MULTIPLE_CHOICE]:
                        if sem_type == ColumnSemanticType.MULTIPLE_CHOICE:
                            all_vals = df[col_name].dropna().astype(str).str.split(r'[,|;]').explode().str.strip()
                            unique_options = all_vals.unique().tolist()
                        else:
                            unique_options = df[col_name].dropna().astype(str).unique().tolist()
                            
                        if len(unique_options) <= 50:
                            update_payload["options"] = unique_options
                            
                    updates.append((col["id"], update_payload))

        if updates:
            print(f"  - Updating {len(updates)} columns...")
            for col_id, payload in updates:
                supabase.table("dataset_columns").update(payload).eq("id", col_id).execute()
            print("  - Done.")
        else:
            print("  - No updates needed.")

if __name__ == "__main__":
    migrate_v1_datasets()
