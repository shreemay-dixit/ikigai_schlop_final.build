from typing import Optional
from pydantic import BaseModel, Field


class QueueIntakeRequestV1(BaseModel):
    user_name: Optional[str] = Field(
        None,
        description="Optional customer / visitor name"
    )
    service_type: int = Field(
        ...,
        ge=0,
        le=2,
        description="Service category index (0, 1, 2)"
    )
    priority_score: int = Field(
        ...,
        ge=1,
        le=5,
        description="Priority score from 1 to 5"
    )
    is_walk_in: bool = Field(
        ...,
        description="True for walk-in visitor, False for pre-booked appointment"
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
        description="Age bracket category (0, 1, 2)"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "user_name": "Test User",
                "service_type": 1,
                "priority_score": 3,
                "is_walk_in": True,
                "party_size": 2,
                "age_bracket": 1
            }
        }
    }


class QueueIntakeResponseV1(BaseModel):
    queue_entry_id: str = Field(..., description="UUID identifier of the created queue entry")
    token: str = Field(..., description="Concurrency-safe queue ticket token (e.g. A-001)")
    predicted_wait_mins: float = Field(..., description="Estimated wait time in minutes")
    priority_score: int = Field(..., description="Assigned priority score (1-5)")
    queue_length_ahead: int = Field(..., description="Number of waiting customers ahead in queue")
    status: str = Field(..., description="Current status (e.g. 'waiting')")
    created_at: str = Field(..., description="ISO 8601 UTC creation timestamp")
