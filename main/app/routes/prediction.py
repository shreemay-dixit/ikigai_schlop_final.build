from typing import Any
from fastapi import APIRouter, HTTPException, Request, status
from main.app.schemas.prediction import PredictionInput, PredictionResponse

router = APIRouter()


@router.post(
    "/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict queue wait time in minutes",
)
async def predict_wait_time(
    payload: PredictionInput, request: Request
) -> PredictionResponse:
    predictor: Any = getattr(request.app.state, "predictor_service", None)
    if not predictor or not predictor.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prediction model is not initialized or ready.",
        )

    try:
        response, _ = predictor.predict(payload)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error: {str(e)}",
        )
