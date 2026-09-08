from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from app.core.supabase import get_supabase_client
import pandas as pd
import json

router = APIRouter()

@router.get("/{dataset_id}/eda")
async def get_exploratory_data_analysis(dataset_id: str, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch Column Semantic Types
    cols_resp = supabase.table("dataset_columns").select("column_name, semantic_type, display_name, data_type").eq("dataset_id", dataset_id).execute()
    if not cols_resp.data:
        return {"total_rows": 0, "columns": []}
        
    col_types = {c["column_name"]: c for c in cols_resp.data}
    
    # Get active version to stream correct rows
    d_res = supabase.table("datasets").select("active_version_id").eq("id", dataset_id).single().execute()
    active_version_id = d_res.data.get("active_version_id") if d_res.data else None
    
    chunk_size = 1000
    current_offset = 0
    total_rows = 0
    
    from collections import Counter
    import math
    
    # Initialize trackers for every column
    trackers = {}
    for col_name, info in col_types.items():
        sem_type = info.get("semantic_type", "UNKNOWN")
        trackers[col_name] = {
            "null_count": 0,
            "semantic_type": sem_type,
            "data_type": info.get("data_type", "UNKNOWN"),
            "is_numeric": sem_type in ["INTEGER", "DECIMAL"],
            "numeric_values": [], # Used to store numbers in-memory for precise median/std
            "value_counts": Counter(), # For categorical/fallback
            "text_length_sum": 0,
            "text_words_sum": 0,
            "text_valid_count": 0
        }
    
    # 2. Stream Data Chunk by Chunk
    while True:
        query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).order("id").range(current_offset, current_offset + chunk_size - 1)
        if active_version_id:
            query = query.eq("version_id", active_version_id)
        else:
            query = query.is_("version_id", "null")
            
        res = query.execute()
        if not res.data:
            break
            
        fetched = res.data
        total_rows += len(fetched)
        
        for r in fetched:
            row_data = r["data"]
            for col_name, tracker in trackers.items():
                val = row_data.get(col_name)
                
                if val is None or val == "":
                    tracker["null_count"] += 1
                    continue
                    
                sem_type = tracker["semantic_type"]
                
                # Numeric
                if tracker["is_numeric"]:
                    try:
                        num_val = float(val)
                        tracker["numeric_values"].append(num_val)
                    except (ValueError, TypeError):
                        tracker["null_count"] += 1
                        
                # Categorical/Tags
                elif sem_type in ["MULTIPLE_CHOICE", "TAGS"]:
                    if isinstance(val, list):
                        for item in val:
                            tracker["value_counts"][str(item).strip()] += 1
                    else:
                        for item in str(val).split(','):
                            tracker["value_counts"][item.strip()] += 1
                            
                # Text
                elif sem_type in ["SHORT_TEXT", "LONG_TEXT"]:
                    str_val = str(val).strip()
                    if str_val:
                        tracker["text_length_sum"] += len(str_val)
                        tracker["text_words_sum"] += len(str_val.split())
                        tracker["text_valid_count"] += 1
                        
                # Fallback for CATEGORY, BOOLEAN, etc
                else:
                    tracker["value_counts"][str(val)] += 1
                    
        if len(fetched) < chunk_size:
            break
            
        current_offset += chunk_size
        
    # 3. Finalize Statistics
    stats = []
    
    if total_rows == 0:
        return {"total_rows": 0, "columns": []}
        
    for col_name, tracker in trackers.items():
        col_stat = {
            "name": col_name,
            "data_type": tracker["data_type"],
            "semantic_type": tracker["semantic_type"],
            "null_count": tracker["null_count"],
            "null_percentage": round((tracker["null_count"] / total_rows) * 100, 2) if total_rows > 0 else 0,
            "is_numeric": tracker["is_numeric"]
        }
        
        if tracker["is_numeric"]:
            nums = tracker["numeric_values"]
            if nums:
                nums.sort() # sort in place for median
                col_stat["min"] = float(nums[0])
                col_stat["max"] = float(nums[-1])
                col_stat["mean"] = float(sum(nums) / len(nums))
                
                # Median
                mid = len(nums) // 2
                if len(nums) % 2 == 0:
                    col_stat["median"] = float((nums[mid - 1] + nums[mid]) / 2.0)
                else:
                    col_stat["median"] = float(nums[mid])
                    
                # StdDev
                if len(nums) > 1:
                    mean_val = col_stat["mean"]
                    variance = sum((x - mean_val) ** 2 for x in nums) / (len(nums) - 1)
                    col_stat["std"] = float(math.sqrt(variance))
                else:
                    col_stat["std"] = 0.0
            else:
                col_stat["min"] = col_stat["max"] = col_stat["mean"] = col_stat["median"] = col_stat["std"] = None
                
            # Free memory explicitly
            tracker["numeric_values"] = []
            
        elif tracker["semantic_type"] in ["SHORT_TEXT", "LONG_TEXT"]:
            v_count = tracker["text_valid_count"]
            if v_count > 0:
                col_stat["avg_length"] = float(tracker["text_length_sum"] / v_count)
                col_stat["avg_words"] = float(tracker["text_words_sum"] / v_count)
            else:
                col_stat["avg_length"] = col_stat["avg_words"] = 0.0
                
        else:
            # Get top 10 categories
            top_10 = tracker["value_counts"].most_common(10)
            col_stat["top_categories"] = [
                {"name": str(k), "count": int(v)} for k, v in top_10
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
