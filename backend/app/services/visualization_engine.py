from typing import Dict, Any, List

class ChartRecommender:
    @staticmethod
    def recommend_charts(column_metadata: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Recommends charts based on the semantic types of the dataset columns.
        """
        recommendations = []
        
        numeric_cols = []
        cat_cols = []
        date_cols = []
        
        for col in column_metadata:
            c_name = col["column_name"]
            sem_type = col.get("semantic_type", col.get("data_type", "UNKNOWN"))
            
            if sem_type in ["INTEGER", "DECIMAL", "NUMERIC"]:
                numeric_cols.append(c_name)
            elif sem_type in ["CATEGORY", "SINGLE_CHOICE", "ORDINAL_CHOICE", "BOOLEAN"]:
                cat_cols.append(c_name)
            elif sem_type in ["DATE", "DATETIME"]:
                date_cols.append(c_name)

        # 1. Bar Chart Recommendations (Categorical frequency)
        for cat in cat_cols[:3]: # Suggest up to 3 categorical charts
            recommendations.append({
                "chart_type": "BAR",
                "x_axis": cat,
                "y_axis": None,
                "aggregation": "COUNT",
                "description": f"View the frequency distribution of {cat}."
            })
            
            # If we have numeric columns, suggest aggregations over categories
            for num in numeric_cols[:2]:
                recommendations.append({
                    "chart_type": "BAR",
                    "x_axis": cat,
                    "y_axis": num,
                    "aggregation": "MEAN",
                    "description": f"Compare average {num} across different {cat} groups."
                })

        # 2. Scatter Plot Recommendations (Numeric vs Numeric)
        for i in range(min(len(numeric_cols), 3)):
            for j in range(i + 1, min(len(numeric_cols), 3)):
                recommendations.append({
                    "chart_type": "SCATTER",
                    "x_axis": numeric_cols[i],
                    "y_axis": numeric_cols[j],
                    "aggregation": "NONE",
                    "description": f"Explore the correlation between {numeric_cols[i]} and {numeric_cols[j]}."
                })

        # 3. Line Chart Recommendations (Time Series)
        for date_col in date_cols[:2]:
            for num in numeric_cols[:2]:
                recommendations.append({
                    "chart_type": "LINE",
                    "x_axis": date_col,
                    "y_axis": num,
                    "aggregation": "SUM",
                    "description": f"Track total {num} over time ({date_col})."
                })

        # Return a curated mix (prioritizing diverse chart types if possible)
        return recommendations[:6]
