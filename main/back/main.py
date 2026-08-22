from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.ml_service import ml_service
from routes import intake, model


@asynccontextmanager
async def lifespan(app: FastAPI):
    
    ml_service.load_model()
    yield
    


app = FastAPI(
    title="Smart Queue Backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(intake.router, prefix="/api/v1")
app.include_router(model.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Smart Queue Backend. Head to /docs for API documentation."}


@app.get("/health")
def health_check():
    return {"status": "ok", "model_loaded": ml_service.is_loaded}
