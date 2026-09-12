import pandas as pd
import numpy as np
import os
import json
from typing import Dict, Any, List

try:
    import google.generativeai as genai
except ImportError:
    genai = None

class AssistantEngine:
    @staticmethod
    def answer_query(query: str, df: pd.DataFrame, column_metadata: List[Dict[str, Any]]) -> str:
        """
        Parses a natural language query and uses an LLM (Gemini) to generate an answer.
        Falls back to a robust keyword-based heuristic if the API key is missing or fails.
        """
        # Attempt to use Gemini if API key is present
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        
        if gemini_api_key and genai is not None:
            try:
                genai.configure(api_key=gemini_api_key)
                model = genai.GenerativeModel('gemini-1.5-flash')
                
                # Construct context payload
                columns_info = ", ".join([f"{c['column_name']} ({c.get('semantic_type') or c.get('data_type')})" for c in column_metadata])
                
                # Get basic stats for context without exposing raw row data
                summary_stats = df.describe(include='all').to_string()
                head_sample = df.head(3).to_string()
                
                prompt = f"""
You are DataLab Assistant, an expert AI data analyst. 
The user is asking a question about their current dataset. Answer the question based ONLY on the provided context.

Dataset Columns & Types:
{columns_info}

Statistical Summary:
{summary_stats}

Sample Data (First 3 rows):
{head_sample}

User Question: "{query}"

Instructions:
1. Be concise, direct, and helpful. Do not output markdown code blocks unless you are writing code.
2. If the user asks for calculations (like average, max, count), try to find the answer in the Statistical Summary. If it's not there, explain that you can't perform exact calculations on arbitrary string categories, but provide the closest approximation from the summary.
3. If the user asks general questions about the dataset's nature, use the schema and sample data to infer.
4. Keep the response under 4 sentences.
"""
                response = model.generate_content(prompt)
                return response.text.strip()
                
            except Exception as e:
                print(f"Gemini LLM failed, falling back to heuristics: {e}")
                # Fallback downwards
                
        # --- Fallback Heuristic Engine ---
        query = query.lower()
        columns_lower = {col["column_name"].lower(): col["column_name"] for col in column_metadata}
        
        # 1. Detect target column
        target_col = None
        import re
        for col_l, col_orig in columns_lower.items():
            if col_l in query:
                if re.search(rf'\b{re.escape(col_l)}\b', query):
                    target_col = col_orig
                    break
                    
        # 2. Detect Intent
        is_count = "count" in query or "how many" in query
        is_avg = "average" in query or "mean" in query
        is_max = "max" in query or "highest" in query or "maximum" in query
        is_min = "min" in query or "lowest" in query or "minimum" in query
        
        if not target_col:
            if is_count and "row" in query or "record" in query:
                return f"There are {len(df):,} rows in this dataset."
            return "I couldn't identify a specific column in your question. Please mention the exact column name, or add your GEMINI_API_KEY to the backend to enable the smart AI Assistant!"
            
        # 3. Execution
        try:
            series = df[target_col]
            
            if is_count:
                for val in series.dropna().unique():
                    if str(val).lower() in query:
                        count_val = (series.astype(str).str.lower() == str(val).lower()).sum()
                        return f"There are {count_val:,} records where {target_col} is '{val}'."
                return f"There are {series.notna().sum():,} non-empty records for '{target_col}'."
                
            if is_avg:
                numeric_series = pd.to_numeric(series, errors='coerce').dropna()
                if len(numeric_series) == 0:
                    return f"'{target_col}' doesn't seem to contain numeric data, so I can't calculate an average."
                return f"The average for '{target_col}' is {numeric_series.mean():.2f}."
                
            if is_max:
                numeric_series = pd.to_numeric(series, errors='coerce').dropna()
                if len(numeric_series) == 0:
                    return f"'{target_col}' doesn't seem to contain numeric data, so I can't find a maximum."
                return f"The maximum value for '{target_col}' is {numeric_series.max():.2f}."
                
            if is_min:
                numeric_series = pd.to_numeric(series, errors='coerce').dropna()
                if len(numeric_series) == 0:
                    return f"'{target_col}' doesn't seem to contain numeric data, so I can't find a minimum."
                return f"The minimum value for '{target_col}' is {numeric_series.min():.2f}."
                
            # Default to summary
            numeric_series = pd.to_numeric(series, errors='coerce').dropna()
            if len(numeric_series) > len(series) * 0.5:
                return f"'{target_col}' is mostly numeric. Its average is {numeric_series.mean():.2f}, ranging from {numeric_series.min()} to {numeric_series.max()}."
            else:
                top_val = series.mode().iloc[0] if not series.mode().empty else "None"
                return f"'{target_col}' has {series.nunique():,} unique values. The most common value is '{top_val}'."
                
        except Exception as e:
            return f"I encountered an error trying to process your request for '{target_col}'. Error: {str(e)}"
