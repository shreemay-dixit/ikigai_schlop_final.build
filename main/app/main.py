from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from main.app.config import settings
from main.app.routes import api_router
from main.app.services.predictor import WaitPredictorService


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load the model artifact exactly once and store at application scope
    predictor = WaitPredictorService(model_path=settings.ML_MODEL_PATH)
    predictor.load_model()
    app.state.predictor_service = predictor
    yield
    # Clean up on shutdown
    app.state.predictor_service = None


def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router, prefix=settings.API_V1_PREFIX)
    return application


app = create_application()
