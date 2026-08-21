from pydantic import BaseModel, Field


class PredictionInput(BaseModel):
    service_type: int = Field(
        ...,
        description="Service category index (e.g. 0, 1, 2)"
    )
    priority_score: int = Field(
        ...,
        ge=1,
        le=5,
        description="Priority score from 1 to 5"
    )
    is_walk_in: int = Field(
        ...,
        ge=0,
        le=1,
        description="Binary flag: 1 for walk-in, 0 for appointment"
    )
    party_size: int = Field(
        ...,
        ge=1,
        description="Number of people in the party (>= 1)"
    )
    age_bracket: int = Field(
        ...,
        ge=0,
        le=2,
        description="Age bracket: 0, 1, or 2"
    )
    queue_length_ahead: int = Field(
        ...,
        ge=0,
        description="Number of people ahead in the queue (>= 0)"
    )
    active_counters: int = Field(
        ...,
        ge=1,
        description="Number of currently active service counters (>= 1)"
    )
    hour_of_day: int = Field(
        ...,
        ge=0,
        le=23,
        description="Hour of the day in 24-hour format (0-23)"
    )
    day_of_week: int = Field(
        ...,
        ge=0,
        le=6,
        description="Day of week (0=Monday, 6=Sunday)"
    )
    rolling_velocity_mins: float = Field(
        ...,
        gt=0.0,
        description="Current rolling service velocity in minutes per person (> 0)"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "service_type": 1,
                "priority_score": 3,
                "is_walk_in": 1,
                "party_size": 2,
                "age_bracket": 1,
                "queue_length_ahead": 8,
                "active_counters": 3,
                "hour_of_day": 14,
                "day_of_week": 2,
                "rolling_velocity_mins": 12.5
            }
        }
    }


class PredictionResponse(BaseModel):
    predicted_wait_mins: float = Field(..., description="Estimated queue wait time in minutes")
    model_identifier: str = Field(..., description="Identifier or name of the loaded ML model")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp of prediction")


class HealthResponse(BaseModel):
    status: str = Field(..., description="Service status: healthy or degraded")
    model_loaded: bool = Field(..., description="True if ML model is in memory and ready")
    model_identifier: str = Field(..., description="Name of the model artifact")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp")
