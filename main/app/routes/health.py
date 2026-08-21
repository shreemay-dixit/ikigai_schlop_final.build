from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Request
from main.app.schemas.prediction import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    predictor: Any = getattr(request.app.state, "predictor_service", None)
    is_loaded = predictor.is_loaded if predictor else False
    model_identifier = predictor.model_identifier if predictor else "none"

    return HealthResponse(
        status="healthy" if is_loaded else "degraded",
        model_loaded=is_loaded,
        model_identifier=model_identifier,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
