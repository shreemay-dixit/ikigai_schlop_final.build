from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class PriorityLevel(str, Enum):
    normal = "normal"
    urgent = "urgent"
    emergency = "emergency"


class IntakeRequest(BaseModel):
    patient_name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=0, le=120)
    reason: str = Field(..., min_length=1, max_length=300)
    priority: PriorityLevel = PriorityLevel.normal


class IntakeResponse(BaseModel):
    token: str
    position_in_queue: int
    estimated_wait_minutes: float
    priority: PriorityLevel
    created_at: datetime


class QueueEntry(BaseModel):
    token: str
    patient_name: str
    age: int
    reason: str
    priority: PriorityLevel
    status: str = "waiting"  
    estimated_wait_minutes: float
    created_at: datetime


class QueueStateResponse(BaseModel):
    total_waiting: int
    entries: list[QueueEntry]


class PriorityUpdateRequest(BaseModel):
    priority: PriorityLevel


class SimpleMessage(BaseModel):
    message: str
