import os
import requests

supabase_url = "https://ewulhccehzjixhmzipmu.supabase.co"
supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dWxoY2NlaHpqaXhobXppcG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2OTk5MDMsImV4cCI6MjEwNDI3NTkwM30.5WFTCtuaFSv0e66y2ILcf2oTmumBSzGlDikgTJq02C0"

headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}"
}

# Fetch datasets where status = PUBLISHED
response = requests.get(f"{supabase_url}/rest/v1/datasets?select=*,profiles:owner_id(full_name)&status=eq.PUBLISHED", headers=headers)
print("Status Code:", response.status_code)
print("Response:", response.json())
