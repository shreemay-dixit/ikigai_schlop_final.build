from fastapi import APIRouter
from main.app.routes.health import router as health_router
from main.app.routes.prediction import router as prediction_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(prediction_router)
