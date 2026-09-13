import pandas as pd
import numpy as np
from typing import Dict, Any, List
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import NMF

class NLPEngine:
    @staticmethod
    def extract_topics(series: pd.Series, n_topics: int = 3, n_top_words: int = 5) -> List[Dict[str, Any]]:
        """
        Extract topics from a text column using TF-IDF and NMF (Non-negative Matrix Factorization).
        """
        # Drop nulls and convert to strings
        texts = series.dropna().astype(str).tolist()
        
        if len(texts) < 10:
            return [{"topic_id": 0, "keywords": ["Not enough data for topic modeling"], "weight": 1.0}]
            
        try:
            # TF-IDF Vectorization
            tfidf_vectorizer = TfidfVectorizer(max_df=0.95, min_df=2, stop_words='english')
            tfidf = tfidf_vectorizer.fit_transform(texts)
            
            # NMF Model
            nmf = NMF(n_components=min(n_topics, len(texts) // 5), random_state=1, l1_ratio=.5).fit(tfidf)
            
            feature_names = tfidf_vectorizer.get_feature_names_out()
            
            topics = []
            for topic_idx, topic in enumerate(nmf.components_):
                top_features_ind = topic.argsort()[:-n_top_words - 1:-1]
                top_features = [feature_names[i] for i in top_features_ind]
                weights = topic[top_features_ind]
                
                topics.append({
                    "topic_id": topic_idx + 1,
                    "keywords": top_features,
                    "weight": float(np.sum(weights)) # relative importance
                })
                
            return topics
        except Exception as e:
            return [{"topic_id": 0, "keywords": [f"Error extracting topics: {str(e)}"], "weight": 0}]

    @staticmethod
    def analyze_sentiment_distribution(series: pd.Series) -> Dict[str, Any]:
        """
        Basic sentiment analysis using a simple heuristic (lexicon-based) 
        to avoid heavy dependencies like Transformers/TextBlob if not installed, 
        but in a real app would use VADER or HuggingFace.
        """
        # Very rudimentary lexicon for demonstration
        positive_words = {'good', 'great', 'excellent', 'amazing', 'love', 'best', 'happy', 'positive', 'yes', 'awesome'}
        negative_words = {'bad', 'terrible', 'awful', 'hate', 'worst', 'sad', 'negative', 'no', 'poor', 'fail'}
        
        texts = series.dropna().astype(str).str.lower()
        
        results = {"positive": 0, "neutral": 0, "negative": 0}
        
        for text in texts:
            words = set(text.split())
            pos_score = len(words.intersection(positive_words))
            neg_score = len(words.intersection(negative_words))
            
            if pos_score > neg_score:
                results["positive"] += 1
            elif neg_score > pos_score:
                results["negative"] += 1
            else:
                results["neutral"] += 1
                
        total = len(texts)
        if total == 0:
            return {"positive": 0, "neutral": 0, "negative": 0}
            
        return {
            "positive_pct": round((results["positive"] / total) * 100, 1),
            "neutral_pct": round((results["neutral"] / total) * 100, 1),
            "negative_pct": round((results["negative"] / total) * 100, 1),
            "total_analyzed": total
        }

    @staticmethod
    def get_text_statistics(series: pd.Series) -> Dict[str, Any]:
        """
        Calculates advanced text statistics.
        """
        texts = series.dropna().astype(str)
        
        if len(texts) == 0:
            return {}
            
        word_counts = texts.str.split().str.len()
        char_counts = texts.str.len()
        
        return {
            "avg_word_count": round(float(word_counts.mean()), 1),
            "max_word_count": int(word_counts.max()),
            "avg_char_count": round(float(char_counts.mean()), 1),
            "vocabulary_size": len(set(' '.join(texts).lower().split()))
        }

    @staticmethod
    def run_full_nlp_analysis(df: pd.DataFrame, text_column: str) -> Dict[str, Any]:
        if text_column not in df.columns:
            raise ValueError(f"Column '{text_column}' not found in dataset.")
            
        series = df[text_column]
        
        return {
            "column": text_column,
            "statistics": NLPEngine.get_text_statistics(series),
            "sentiment": NLPEngine.analyze_sentiment_distribution(series),
            "topics": NLPEngine.extract_topics(series, n_topics=4)
        }

    @staticmethod
    def semantic_search(df: pd.DataFrame, text_column: str, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Performs semantic search using sentence-transformers (all-MiniLM-L6-v2).
        Lazy loads the model to prevent startup crashes if not installed.
        """
        try:
            from sentence_transformers import SentenceTransformer, util
            import torch
        except ImportError:
            raise ImportError("sentence-transformers is not installed. Please run `pip install sentence-transformers`.")

        if text_column not in df.columns:
            raise ValueError(f"Column '{text_column}' not found in dataset.")

        # Keep track of original indices and clean text
        df_valid = df.dropna(subset=[text_column]).copy()
        if df_valid.empty:
            return []

        texts = df_valid[text_column].astype(str).tolist()

        # Load model (downloads on first run, caches locally in ~/.cache/huggingface)
        model = SentenceTransformer('all-MiniLM-L6-v2')

        # Encode query and corpus
        query_embedding = model.encode(query, convert_to_tensor=True)
        corpus_embeddings = model.encode(texts, convert_to_tensor=True)

        # Compute cosine similarities
        cos_scores = util.cos_sim(query_embedding, corpus_embeddings)[0]
        
        # Get top K results
        top_results = torch.topk(cos_scores, k=min(top_k, len(texts)))
        
        results = []
        for score, idx in zip(top_results[0], top_results[1]):
            score_val = score.item()
            idx_val = idx.item()
            
            # Reconstruct the original row data
            row_data = df_valid.iloc[idx_val].to_dict()
            
            results.append({
                "score": round(score_val, 4),
                "matched_text": texts[idx_val],
                "row_data": row_data
            })
            
        return results
