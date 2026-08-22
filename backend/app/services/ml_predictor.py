import os
import math
import logging
from pathlib import Path
from typing import Dict, Any, Optional

import joblib
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Step 1: Model Loading Function
def load_model(model_path: str):
    """
    Loads the Scikit-Learn Random Forest regression artifact from disk.
    Supports relative and absolute paths.
    """
    p = Path(model_path)
    if not p.is_absolute():
        # Check relative to backend/ and relative to root
        backend_dir = Path(__file__).resolve().parent.parent.parent
        candidate1 = backend_dir / p
        candidate2 = backend_dir.parent / p
        if candidate1.exists():
            p = candidate1
        elif candidate2.exists():
            p = candidate2

    if p.exists():
        try:
            model = joblib.load(p)
            logger.info(f"[ml_predictor] Successfully loaded model from {p}")
            return model
        except Exception as e:
            logger.error(f"[ml_predictor] Failed to load model from {p}: {e}")
            return None
    else:
        logger.warning(f"[ml_predictor] Model file not found at {p}")
        return None

# Step 1: Tree-Variance Prediction Function
def predict_wait_with_variance(model, features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Performs Random Forest inference and computes tree-variance bounds across individual decision trees.
    
    Expected feature columns matching training schema:
    ['service_type', 'priority_score', 'is_walk_in', 'party_size', 'age_bracket',
     'queue_length_ahead', 'active_counters', 'rolling_velocity_mins', 'queuing_theory_baseline']
    """
    baseline = float(features.get('queuing_theory_baseline', 2.0))
    
    if model is None:
        # Fallback to pure queuing theory baseline
        low = max(2, math.floor(baseline * 0.85))
        high = max(low + 1, math.ceil(baseline * 1.15))
        display_range = "Under 5 mins" if baseline <= 5.0 else f"{low} - {high} mins"
        return {
            "predicted_exact": round(baseline, 1),
            "lower_bound": low,
            "upper_bound": high,
            "display_range": display_range
        }

    try:
        # Convert dictionary to DataFrame matching exact training feature columns
        df_row = {
            'service_type': features.get('service_type', 1),
            'priority_score': features.get('priority_score', 1),
            'is_walk_in': features.get('is_walk_in', 1),
            'party_size': features.get('party_size', 1),
            'age_bracket': features.get('age_bracket', 1),
            'queue_length_ahead': features.get('queue_length_ahead', 0),
            'active_counters': features.get('active_counters', 2),
            'rolling_velocity_mins': features.get('rolling_velocity_mins', 12.0),
            'queuing_theory_baseline': baseline
        }
        
        # Include optional hour_of_day and day_of_week if present in model
        if hasattr(model, 'feature_names_in_'):
            if 'hour_of_day' in model.feature_names_in_:
                df_row['hour_of_day'] = features.get('hour_of_day', 12)
            if 'day_of_week' in model.feature_names_in_:
                df_row['day_of_week'] = features.get('day_of_week', 2)
                
            cols = [c for c in model.feature_names_in_ if c in df_row]
            feature_df = pd.DataFrame([df_row])[cols]
        else:
            feature_df = pd.DataFrame([df_row])

        # Point prediction from the ensemble
        ensemble_pred = float(model.predict(feature_df)[0])
        ensemble_pred = max(2.0, round(ensemble_pred, 1))

        # Individual decision tree predictions
        if hasattr(model, 'estimators_') and len(model.estimators_) > 0:
            tree_preds = np.array([tree.predict(feature_df.values)[0] for tree in model.estimators_])
            mean = float(np.mean(tree_preds))
            std_dev = float(np.std(tree_preds))
        else:
            mean = ensemble_pred
            std_dev = ensemble_pred * 0.15

        # Lower and upper variance bounds
        lower_bound = max(2, math.floor(mean - std_dev))
        upper_bound = max(lower_bound + 1, math.ceil(mean + std_dev))

        # Format display range string
        if ensemble_pred <= 5.0 or mean <= 5.0:
            display_range = "Under 5 mins"
        else:
            display_range = f"{lower_bound} - {upper_bound} mins"

        return {
            "predicted_exact": ensemble_pred,
            "lower_bound": lower_bound,
            "upper_bound": upper_bound,
            "display_range": display_range
        }

    except Exception as e:
        logger.error(f"[ml_predictor] Prediction error ({e}); using queuing baseline fallback.")
        low = max(2, math.floor(baseline * 0.85))
        high = max(low + 1, math.ceil(baseline * 1.15))
        display_range = "Under 5 mins" if baseline <= 5.0 else f"{low} - {high} mins"
        return {
            "predicted_exact": round(baseline, 1),
            "lower_bound": low,
            "upper_bound": high,
            "display_range": display_range
        }

class MLPredictorService:
    def __init__(self):
        self.model = None
        self.is_loaded = False

    def load_model(self, model_path: str):
        self.model = load_model(model_path)
        self.is_loaded = self.model is not None
        return self.is_loaded

    def predict(self, features: Dict[str, Any], queuing_baseline: float):
        features['queuing_theory_baseline'] = queuing_baseline
        res = predict_wait_with_variance(self.model, features)
        return res['predicted_exact'], res['display_range'], 10.0

ml_predictor = MLPredictorService()
