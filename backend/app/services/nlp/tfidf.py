import pandas as pd
from typing import List

def apply_tfidf(series: pd.Series, nlp_config: dict = None) -> Any:
    # Ensure scikit-learn is installed in environment
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
    except ImportError:
        raise Exception("scikit-learn is not installed.")
        
    config = {
        "max_features": 5000,
        "min_df": 2,
        "max_df": 0.95,
        "ngram_range": (1, 2)
    }
    if nlp_config:
        config.update(nlp_config)
        
    # Convert ngram_range from list to tuple if needed
    if isinstance(config.get("ngram_range"), list):
        config["ngram_range"] = tuple(config["ngram_range"])
        
    vectorizer = TfidfVectorizer(
        max_features=config.get("max_features"),
        min_df=config.get("min_df"),
        max_df=config.get("max_df"),
        ngram_range=config.get("ngram_range")
    )
    
    # Fill NaN with empty string
    cleaned = series.fillna("").astype(str)
    
    # We return the fitted vectorizer and the transformed sparse matrix
    matrix = vectorizer.fit_transform(cleaned)
    return vectorizer, matrix
