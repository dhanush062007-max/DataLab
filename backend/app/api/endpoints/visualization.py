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
def generate_visualization(dataset_id: str, request: VisualizationRequest, supabase: Client = Depends(get_supabase_client)):
    # 1. Fetch active version
    d_res = supabase.table("datasets").select("active_version_id").eq("id", dataset_id).single().execute()
    active_version_id = d_res.data.get("active_version_id") if d_res.data else None
    
    chunk_size = 1000
    current_offset = 0
    
    result_data = []
    
    try:
        if request.chart_type in ["BAR", "LINE", "PIE"]:
            if not request.y_axis and request.aggregation != "COUNT":
                raise ValueError(f"Y-Axis is required for {request.chart_type} unless aggregation is COUNT.")
                
            if request.aggregation == "NONE":
                # Just fetch 100 valid rows and stop
                max_points = 100
                
                while True:
                    query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).order("id").range(current_offset, current_offset + chunk_size - 1)
                    if active_version_id:
                        query = query.eq("version_id", active_version_id)
                    else:
                        query = query.is_("version_id", "null")
                        
                    res = query.execute()
                    fetched = res.data
                    
                    if not fetched:
                        break
                        
                    for r in fetched:
                        row = r["data"]
                        val_x = row.get(request.x_axis)
                        val_y = row.get(request.y_axis) if request.y_axis else None
                        
                        if val_x is None:
                            continue
                            
                        if request.y_axis and val_y is None:
                            continue
                            
                        point = {"name": str(val_x)}
                        if request.y_axis:
                            point[request.y_axis] = val_y
                            
                        result_data.append(point)
                        
                        if len(result_data) >= max_points:
                            break
                            
                    if len(result_data) >= max_points or len(fetched) < chunk_size:
                        break
                        
                    current_offset += chunk_size
                    
            else:
                # Aggregations (Stream all chunks)
                groups = {}
                
                while True:
                    query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).order("id").range(current_offset, current_offset + chunk_size - 1)
                    if active_version_id:
                        query = query.eq("version_id", active_version_id)
                    else:
                        query = query.is_("version_id", "null")
                        
                    res = query.execute()
                    fetched = res.data
                    
                    if not fetched:
                        break
                        
                    for r in fetched:
                        row = r["data"]
                        val_x = row.get(request.x_axis)
                        if val_x is None:
                            continue
                            
                        x_str = str(val_x)
                        
                        if request.aggregation == "COUNT":
                            if x_str not in groups:
                                groups[x_str] = 0
                            groups[x_str] += 1
                        else:
                            val_y = row.get(request.y_axis)
                            if val_y is None:
                                continue
                                
                            try:
                                num_y = float(val_y)
                            except (ValueError, TypeError):
                                continue
                                
                            if x_str not in groups:
                                if request.aggregation == "MEAN":
                                    groups[x_str] = {"sum": 0.0, "count": 0}
                                else:
                                    groups[x_str] = num_y if request.aggregation in ["MIN", "MAX"] else 0.0
                                    
                            if request.aggregation == "SUM":
                                groups[x_str] += num_y
                            elif request.aggregation == "MEAN":
                                groups[x_str]["sum"] += num_y
                                groups[x_str]["count"] += 1
                            elif request.aggregation == "MIN":
                                if num_y < groups[x_str]:
                                    groups[x_str] = num_y
                            elif request.aggregation == "MAX":
                                if num_y > groups[x_str]:
                                    groups[x_str] = num_y
                                    
                    if len(fetched) < chunk_size:
                        break
                    current_offset += chunk_size
                    
                # Compile groups into result_data
                for k, v in groups.items():
                    point = {"name": k}
                    if request.aggregation == "COUNT":
                        point["COUNT"] = v
                    elif request.aggregation == "MEAN":
                        point[request.y_axis] = v["sum"] / v["count"] if v["count"] > 0 else None
                    else:
                        point[request.y_axis] = v
                        
                    result_data.append(point)
                    
                # Sort and limit to top 100 for browser performance
                if request.aggregation == "COUNT":
                    result_data.sort(key=lambda x: x["COUNT"], reverse=True)
                    request.y_axis = "COUNT"
                elif request.aggregation in ["SUM", "MEAN", "MAX", "MIN"]:
                    result_data.sort(key=lambda x: x[request.y_axis] if x[request.y_axis] is not None else float('-inf'), reverse=True)
                    
                result_data = result_data[:100]
                    
        elif request.chart_type == "SCATTER":
            if not request.y_axis:
                raise ValueError("Y-Axis is required for Scatter Plot.")
                
            max_points = 500
            while True:
                query = supabase.table("dataset_records").select("data").eq("dataset_id", dataset_id).order("id").range(current_offset, current_offset + chunk_size - 1)
                if active_version_id:
                    query = query.eq("version_id", active_version_id)
                else:
                    query = query.is_("version_id", "null")
                    
                res = query.execute()
                fetched = res.data
                
                if not fetched:
                    break
                    
                for r in fetched:
                    row = r["data"]
                    val_x = row.get(request.x_axis)
                    val_y = row.get(request.y_axis)
                    
                    if val_x is None or val_y is None:
                        continue
                        
                    result_data.append({
                        request.x_axis: val_x,
                        request.y_axis: val_y
                    })
                    
                    if len(result_data) >= max_points:
                        break
                        
                if len(result_data) >= max_points or len(fetched) < chunk_size:
                    break
                    
                current_offset += chunk_size
                
        # Safety check: convert any NaNs to None for JSON compliance
        for item in result_data:
            for k, v in item.items():
                if isinstance(v, float) and math.isnan(v):
                    item[k] = None

        return {
            "chart_type": request.chart_type,
            "x_axis": request.x_axis,
            "y_axis": request.y_axis,
            "data": result_data
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Visualization Error: {str(e)}")

from app.services.visualization_engine import ChartRecommender

@router.get("/{dataset_id}/visualize/recommendations")
def get_chart_recommendations(dataset_id: str, supabase: Client = Depends(get_supabase_client)):
    try:
        # Fetch column metadata
        c_res = supabase.table("dataset_columns").select("*").eq("dataset_id", dataset_id).execute()
        if not c_res.data:
            return []
        
        column_metadata = c_res.data
        recommendations = ChartRecommender.recommend_charts(column_metadata)
        
        return recommendations
    except Exception as e:
        print(f"Error generating chart recommendations: {e}")
        return []
