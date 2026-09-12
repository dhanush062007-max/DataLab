from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from supabase import Client
from app.core.supabase import get_supabase_client
import pandas as pd
from app.services.assistant_engine import AssistantEngine

router = APIRouter()

class ChatRequest(BaseModel):
    query: str

@router.post("/{dataset_id}/assistant/query")
def process_natural_language_query(dataset_id: str, chat_req: ChatRequest, supabase: Client = Depends(get_supabase_client)):
    try:
        # 1. Fetch active version & column metadata
        d_res = supabase.table("datasets").select("active_version_id").eq("id", dataset_id).single().execute()
        active_version_id = d_res.data.get("active_version_id") if d_res.data else None
        
        c_res = supabase.table("dataset_columns").select("*").eq("dataset_id", dataset_id).execute()
        column_metadata = c_res.data or []
        
        # 2. Fetch Sampled Data for processing
        query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).limit(10000)
        if active_version_id:
            query = query.eq("version_id", active_version_id)
        else:
            query = query.is_("version_id", "null")
            
        r_res = query.execute()
        if not r_res.data:
            raise HTTPException(status_code=400, detail="No data available for querying.")
            
        df = pd.DataFrame([r["data"] for r in r_res.data])
        
        # 3. Fetch past conversation history (memory)
        # We need the user's ID to fetch their specific chat history, but since this route doesn't force auth yet,
        # we can fetch history by dataset_id. However, fetching by dataset_id alone might mix users if it's public.
        # For simplicity, let's fetch the last 5 logs for this dataset_id regardless of user for now, or just the user's if available.
        # To make it safer, we just fetch by dataset_id.
        h_res = supabase.table("assistant_logs").select("query, response, created_at").eq("dataset_id", dataset_id).order("created_at", desc=True).limit(5).execute()
        history = h_res.data or []
        # Reverse to chronological order (oldest first)
        history.reverse()
        
        # 4. Process via AssistantEngine
        response = AssistantEngine.answer_query(chat_req.query, df, column_metadata, history)
        
        return {"response": response}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Assistant failed: {str(e)}")
