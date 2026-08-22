import logging
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

class MLPredictorService:
    """
    Manages loading the Random Forest PKL artifact and computing
    residual wait-time predictions + tree-variance confidence intervals.
    """
    def __init__(self):
        self.model = None
        self.is_loaded = False

    def load_model(self, model_path: Path) -> bool:
        try:
            if model_path.exists():
                self.model = joblib.load(model_path)
                self.is_loaded = True
                logger.info(f"[ml_predictor] Successfully loaded model from {model_path}")
                return True
            else:
                logger.warning(f"[ml_predictor] Model artifact not found at {model_path}. Using fallback.")
                self.model = None
                self.is_loaded = False
                return False
        except Exception as e:
            logger.error(f"[ml_predictor] Failed to load model ({e}). Using fallback.")
            self.model = None
            self.is_loaded = False
            return False

    def predict(
        self,
        features: Dict[str, Any],
        queuing_baseline: float
    ) -> Tuple[float, str, float]:
        """
        Executes Random Forest residual inference and formats confidence interval
        derived from individual estimator tree predictions.
        Returns: (predicted_wait_mins, display_range, relative_error_pct)
        """
        if self.model is not None:
            try:
                feature_df = pd.DataFrame([{
                    'service_type': features.get('service_type', 1),
                    'priority_score': features.get('priority_score', 1),
                    'is_walk_in': features.get('is_walk_in', 1),
                    'party_size': features.get('party_size', 1),
                    'age_bracket': features.get('age_bracket', 1),
                    'queue_length_ahead': features.get('queue_length_ahead', 0),
                    'active_counters': features.get('active_counters', 2),
                    'hour_of_day': features.get('hour_of_day', 12),
                    'day_of_week': features.get('day_of_week', 2),
                    'rolling_velocity_mins': features.get('rolling_velocity_mins', 12.0),
                    'queuing_theory_baseline': queuing_baseline
                }])

                if hasattr(self.model, 'feature_names_in_'):
                    cols = [c for c in self.model.feature_names_in_ if c in feature_df.columns]
                    feature_df = feature_df[cols]

                # Main ensemble prediction
                point_pred = float(self.model.predict(feature_df)[0])
                point_pred = max(2.0, round(point_pred, 1))

                # Compute variance across individual tree estimators
                if hasattr(self.model, 'estimators_'):
                    tree_preds = np.array([tree.predict(feature_df.values)[0] for tree in self.model.estimators_])
                    std_dev = float(np.std(tree_preds))
                    p10 = max(2.0, round(float(np.percentile(tree_preds, 10)), 1))
                    p90 = max(p10 + 1.0, round(float(np.percentile(tree_preds, 90)), 1))
                    display_range = f"{int(round(p10))} – {int(round(p90))} mins"
                    rel_err = round((std_dev / max(1.0, point_pred)) * 100, 1)
                else:
                    low = max(2.0, round(point_pred * 0.85, 1))
                    high = max(low + 1.0, round(point_pred * 1.15, 1))
                    display_range = f"{int(round(low))} – {int(round(high))} mins"
                    rel_err = 10.0

                return point_pred, display_range, rel_err

            except Exception as e:
                logger.error(f"[ml_predictor] Prediction failure ({e}). Using queuing baseline fallback.")

        # Fallback to pure deterministic queuing baseline
        low = max(2.0, round(queuing_baseline * 0.85, 1))
        high = max(low + 1.0, round(queuing_baseline * 1.15, 1))
        display_range = f"{int(round(low))} – {int(round(high))} mins"
        return queuing_baseline, display_range, 12.0

ml_predictor = MLPredictorService()
