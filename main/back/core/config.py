from pathlib import Path


class Settings:
    APP_NAME = "Smart Queue Backend"
    BASE_DIR = Path(__file__).resolve().parent.parent
    MODEL_PATH = BASE_DIR / "ml" / "wait_predictor.pkl"
    DEFAULT_SERVICE_TIME_MIN = 8.0  


settings = Settings()
