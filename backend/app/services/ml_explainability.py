import pandas as pd
import numpy as np
from typing import Dict, Any

try:
    import shap
except ImportError:
    shap = None

class MLExplainability:
    @staticmethod
    def compute_global_shap(model: Any, X_train: pd.DataFrame, feature_names: list) -> Dict[str, float]:
        """
        Computes global SHAP feature importance for a trained model.
        Returns a dictionary mapping feature names to their mean absolute SHAP values.
        """
        if shap is None:
            print("SHAP is not installed. Skipping explainability.")
            return {}
            
        try:
            # Use a background sample for speed if the dataset is large
            bg_size = min(100, len(X_train))
            background = shap.sample(X_train, bg_size)
            
            # Determine explainer type based on the model
            model_type = str(type(model)).lower()
            
            if "ensemble" in model_type or "tree" in model_type or "forest" in model_type:
                explainer = shap.TreeExplainer(model)
                # TreeExplainer is fast, can compute on full X_train, but let's use a sample to be safe
                shap_values = explainer.shap_values(background)
            else:
                # Linear models or others
                explainer = shap.LinearExplainer(model, background)
                shap_values = explainer.shap_values(background)
                
            # For classification, shap_values is a list of arrays (one for each class)
            if isinstance(shap_values, list):
                # Take the mean across classes, or just the first class for binary
                mean_abs_shap = np.mean([np.abs(sv).mean(axis=0) for sv in shap_values], axis=0)
            else:
                mean_abs_shap = np.abs(shap_values).mean(axis=0)
                
            # Map to feature names
            importances = {name: float(val) for name, val in zip(feature_names, mean_abs_shap)}
            
            # Normalize to sum to 1
            total = sum(importances.values())
            if total > 0:
                importances = {k: v / total for k, v in importances.items()}
                
            # Sort descending
            return dict(sorted(importances.items(), key=lambda item: item[1], reverse=True))
            
        except Exception as e:
            print(f"SHAP explanation failed: {e}")
            return {}
