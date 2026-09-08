import pandas as pd
from typing import List

# We initialize this lazily to avoid loading heavy models on import
_model = None

def get_embedding_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            # Using the fast, open-source MiniLM model as requested
            _model = SentenceTransformer('all-MiniLM-L6-v2')
        except ImportError:
            raise Exception("sentence-transformers is not installed. Run `pip install sentence-transformers`")
    return _model

def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generate dense vector embeddings for a list of strings.
    """
    model = get_embedding_model()
    # Fill NaN or None with empty strings
    cleaned_texts = [str(t) if pd.notna(t) and t is not None else "" for t in texts]
    
    # Generate embeddings (returns a numpy array)
    embeddings = model.encode(cleaned_texts, show_progress_bar=False)
    
    # Convert to standard Python lists for JSON serialization if needed
    return embeddings.tolist()
