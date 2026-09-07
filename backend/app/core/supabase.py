from supabase import create_client, Client, ClientOptions
from app.core.config import settings
from dotenv import load_dotenv
import os
from fastapi import Header

load_dotenv()

supabase_url: str = settings.SUPABASE_URL or os.getenv("SUPABASE_URL", "")
supabase_key: str = settings.SUPABASE_KEY or os.getenv("SUPABASE_KEY", "")

if not supabase_url or not supabase_key:
    raise Exception("Missing Supabase configuration in environment variables.")

# Global fallback client (does not have user context)
supabase: Client = create_client(supabase_url, supabase_key)

# Dependency for FastAPI routes
def get_supabase_client(authorization: str = Header(None)) -> Client:
    client = create_client(supabase_url, supabase_key)
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        print(f"DEBUG: Setting postgrest auth token: {token[:10]}...")
        client.postgrest.auth(token)
    else:
        print(f"DEBUG: No valid Bearer token provided in headers.")
    return client
