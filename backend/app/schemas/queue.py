from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class StatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Target status: 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show'")
    counter_id: Optional[str] = Field(None, description="Optional desk/counter identifier servicing the ticket")

class QueueEntrySchema(BaseModel):
    id: str
    business_id: str
    ticket_number: str
    phone_number: Optional[str] = None
    priority_score: int
    predicted_wait_mins: float
    display_range: str
    status: str
    served_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

class QueueSnapshotResponse(BaseModel):
    business_id: str
    active_counters: int
    waiting_count: int
    rolling_velocity_mins: float
    arrival_rate_lambda_per_min: float
    system_utilization_rho: float
    queue_entries: List[QueueEntrySchema]

class HealthCheckResponse(BaseModel):
    status: str
    database_connected: bool
    ml_model_loaded: bool
    gemini_api_ready: bool
    timestamp: datetime
