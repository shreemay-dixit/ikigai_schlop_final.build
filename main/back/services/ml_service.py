import joblib
import numpy as np

from core.config import settings


class MLService:
    """
    Wraps the wait-time prediction model.

    Falls back to a simple heuristic if the model file is missing,
    fails to load, or the .predict() call errors out for any reason —
    so the API never goes down just because the ML side has a problem.
    """

    def __init__(self):
        self._model = None
        self.is_loaded = False

    def load_model(self):
        """Load (or reload) the pickled model from disk."""
        try:
            if settings.MODEL_PATH.exists():
                self._model = joblib.load(settings.MODEL_PATH)
                self.is_loaded = True
                print(f"[ml_service] model loaded from {settings.MODEL_PATH}")
            else:
                self._model = None
                self.is_loaded = False
                print(
                    f"[ml_service] no model file at {settings.MODEL_PATH} — "
                    "using heuristic fallback"
                )
        except Exception as e:
            self._model = None
            self.is_loaded = False
            print(f"[ml_service] failed to load model: {e} — using heuristic fallback")

    def reload_model(self) -> bool:
        """
        13. Model hot-swapping.
        Re-reads the .pkl from disk without restarting the server — call
        this (via POST /api/v1/model/reload) after dropping in a new file.
        """
        self.load_model()
        return self.is_loaded

    def predict_wait_time(self, features: dict) -> float:
        """
        features keys: queue_length, priority_score, hour_of_day, avg_service_time
        Returns predicted wait time in minutes.
        """
        if self._model is not None:
            try:
                X = np.array([[
                    features["queue_length"],
                    features["priority_score"],
                    features["hour_of_day"],
                    features["avg_service_time"],
                ]])
                prediction = self._model.predict(X)[0]
                return max(0.0, round(float(prediction), 1))
            except Exception as e:
                print(f"[ml_service] prediction failed, using fallback: {e}")

        
        return self._heuristic_fallback(features)

    @staticmethod
    def _heuristic_fallback(features: dict) -> float:
        """
        Simple rule-based estimate used when there's no trained model yet,
        or a real prediction call fails. queue_length * avg_service_time,
        discounted by how urgent the patient is.
        """
        queue_length = features.get("queue_length", 0)
        avg_service_time = features.get("avg_service_time", settings.DEFAULT_SERVICE_TIME_MIN)
        priority_score = features.get("priority_score", 1.0)

        base_wait = queue_length * avg_service_time
        adjusted = base_wait / priority_score
        return round(max(0.0, adjusted), 1)



ml_service = MLService()
