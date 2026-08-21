import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_MODEL_PATH = str(BASE_DIR / "wait_predictor_cv.pkl")


class Settings:
    PROJECT_NAME: str = "Queue Wait Time Predictor API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    ML_MODEL_PATH: str = os.getenv("ML_MODEL_PATH", DEFAULT_MODEL_PATH)


settings = Settings()
