import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Tuple
import joblib
import pandas as pd
from main.app.schemas.prediction import PredictionInput, PredictionResponse

EXPECTED_FEATURES = [
    "service_type",
    "priority_score",
    "is_walk_in",
    "party_size",
    "age_bracket",
    "queue_length_ahead",
    "active_counters",
    "hour_of_day",
    "day_of_week",
    "rolling_velocity_mins",
]


class WaitPredictorService:
    def __init__(self, model_path: str):
        self.model_path = model_path
        self.model: Any = None
        self.model_identifier = Path(model_path).name

    def load_model(self) -> None:
        """Loads the pre-trained scikit-learn model into memory."""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(
                f"Model artifact not found at: {self.model_path}"
            )
        self.model = joblib.load(self.model_path)

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def construct_features_df(self, payload: PredictionInput) -> pd.DataFrame:
        """
        Constructs a single-row pandas DataFrame using the exact feature names
        and order expected by wait_predictor_cv.pkl.
        """
        data = {
            "service_type": [payload.service_type],
            "priority_score": [payload.priority_score],
            "is_walk_in": [payload.is_walk_in],
            "party_size": [payload.party_size],
            "age_bracket": [payload.age_bracket],
            "queue_length_ahead": [payload.queue_length_ahead],
            "active_counters": [payload.active_counters],
            "hour_of_day": [payload.hour_of_day],
            "day_of_week": [payload.day_of_week],
            "rolling_velocity_mins": [payload.rolling_velocity_mins],
        }
        return pd.DataFrame(data, columns=EXPECTED_FEATURES)

    def predict(self, payload: PredictionInput) -> Tuple[PredictionResponse, pd.DataFrame]:
        """
        Runs model inference using the input payload and returns a validated
        response along with the exact DataFrame passed to the model.
        """
        if not self.is_loaded:
            raise RuntimeError("Model is not loaded.")

        df = self.construct_features_df(payload)
        raw_prediction = self.model.predict(df)
        
        # Convert numpy float to standard Python float and ensure non-negative
        predicted_wait = float(raw_prediction[0])
        predicted_wait = max(0.0, round(predicted_wait, 2))

        response = PredictionResponse(
            predicted_wait_mins=predicted_wait,
            model_identifier=self.model_identifier,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        return response, df
