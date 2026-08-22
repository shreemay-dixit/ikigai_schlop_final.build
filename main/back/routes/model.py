from fastapi import APIRouter

from schemas.intake import SimpleMessage
from services.ml_service import ml_service

router = APIRouter(prefix="/model", tags=["model"])


@router.post("/reload", response_model=SimpleMessage)
def reload_model():
    """
    13. Model hot-swapping.
    Drop a new wait_predictor.pkl into ml/, then hit this endpoint —
    no server restart needed.
    """
    success = ml_service.reload_model()
    status = "loaded" if success else "not found, using heuristic fallback"
    return SimpleMessage(message=f"model reload attempted — {status}")
