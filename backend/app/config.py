import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    APP_NAME: str = "Smart Queue Intelligence API"
    VERSION: str = "3.0.0"
    
    # Supabase config
    SUPABASE_URL: str = Field(default="https://placeholder.supabase.co")
    SUPABASE_KEY: str = Field(default="placeholder_key")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(default="")
    
    # Gemini API config
    GEMINI_API_KEY: str = Field(default="")
    
    # ML model path
    ML_MODEL_PATH: str = Field(default="models/wait_predictor_cv.pkl")
    
    # Default operational parameters
    DEFAULT_ACTIVE_COUNTERS: int = 2
    DEFAULT_SERVICE_TIME_MIN: float = 12.0
    
    model_config = SettingsConfigDict(
        env_file=os.path.join(BASE_DIR, ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def resolved_model_path(self) -> Path:
        p = Path(self.ML_MODEL_PATH)
        if p.is_absolute():
            return p
        # Check backend/models/
        backend_p = BASE_DIR / p
        if backend_p.exists():
            return backend_p
        # Check root models/
        root_p = BASE_DIR.parent / p
        if root_p.exists():
            return root_p
        # Check root wait_predictor_cv.pkl
        root_direct = BASE_DIR.parent / "wait_predictor_cv.pkl"
        if root_direct.exists():
            return root_direct
        return backend_p

settings = Settings()
