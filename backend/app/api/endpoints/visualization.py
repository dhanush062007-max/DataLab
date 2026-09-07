from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Any, Dict, Optional, List
from supabase import Client
from app.core.supabase import get_supabase_client
import pandas as pd
import math
import json

router = APIRouter()

class VisualizationRequest(BaseModel):
    chart_type: str # BAR, LINE, SCATTER, PIE
    x_axis: str
    y_axis: Optional[str] = None
    aggregation: str = "NONE" # SUM, MEAN, COUNT, MIN, MAX, NONE

@router.post("/{dataset_id}/visualize")
async def generate_visualization(dataset_id: str, request: VisualizationRequest, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch current dataset records
    query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id)
    response = query.execute()
    records = response.data
    
    if not records:
        raise HTTPException(status_code=400, detail="Dataset is empty.")
        
    df = pd.DataFrame([r["data"] for r in records])
    
    try:
        # Check columns
        if request.x_axis not in df.columns:
            raise ValueError(f"X-Axis column '{request.x_axis}' not found.")
        if request.y_axis and request.y_axis not in df.columns:
            raise ValueError(f"Y-Axis column '{request.y_axis}' not found.")
            
        result_data = []

        if request.chart_type in ["BAR", "LINE", "PIE"]:
            if not request.y_axis and request.aggregation != "COUNT":
                raise ValueError(f"Y-Axis is required for {request.chart_type} unless aggregation is COUNT.")
                
            clean_df = df.copy()
            
            # Perform Aggregation
            if request.aggregation == "NONE":
                # No aggregation, just take top 100 rows to prevent overwhelming the browser
                if request.y_axis:
                    clean_df = clean_df[[request.x_axis, request.y_axis]].dropna()
                else:
                    clean_df = clean_df[[request.x_axis]].dropna()
                result_df = clean_df.head(100)
            else:
                # Need to group by X
                # Drop NaNs in X
                clean_df = clean_df.dropna(subset=[request.x_axis])
                
                if request.aggregation == "COUNT":
                    # Count occurrences of X
                    result_df = clean_df.groupby(request.x_axis).size().reset_index(name='COUNT')
                    request.y_axis = 'COUNT' # Reassign y_axis to COUNT for the output
                else:
                    # Drop NaNs in Y
                    clean_df = clean_df.dropna(subset=[request.y_axis])
                    
                    if request.aggregation == "SUM":
                        result_df = clean_df.groupby(request.x_axis)[request.y_axis].sum().reset_index()
                    elif request.aggregation == "MEAN":
                        result_df = clean_df.groupby(request.x_axis)[request.y_axis].mean().reset_index()
                    elif request.aggregation == "MIN":
                        result_df = clean_df.groupby(request.x_axis)[request.y_axis].min().reset_index()
                    elif request.aggregation == "MAX":
                        result_df = clean_df.groupby(request.x_axis)[request.y_axis].max().reset_index()

            # Format for Recharts
            result_df['name'] = result_df[request.x_axis].astype(str)
            cols_to_keep = ['name']
            if request.y_axis:
                cols_to_keep.append(request.y_axis)
                
            final_df = result_df[cols_to_keep].copy()
            # Replace NaNs with None for JSON compliance
            final_df = final_df.replace({float('nan'): None})
            result_data = json.loads(final_df.to_json(orient="records"))
                
        elif request.chart_type == "SCATTER":
            if not request.y_axis:
                raise ValueError("Y-Axis is required for Scatter Plot.")
            
            clean_df = df[[request.x_axis, request.y_axis]].dropna()
            
            # Limit to 500 points for scatter
            result_df = clean_df.head(500)
            
            final_df = result_df[[request.x_axis, request.y_axis]].copy()
            final_df = final_df.replace({float('nan'): None})
            result_data = json.loads(final_df.to_json(orient="records"))

        return {
            "chart_type": request.chart_type,
            "x_axis": request.x_axis,
            "y_axis": request.y_axis,
            "data": result_data
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Visualization Error: {str(e)}")
