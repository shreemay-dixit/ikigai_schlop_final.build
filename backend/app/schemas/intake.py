from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class IntakeRequest(BaseModel):
    business_id: str = Field(..., description="Unique business or branch identifier in Supabase tenants table")
    user_text: str = Field(..., description="Natural language reason for visit or customer description")
    phone_number: Optional[str] = Field(None, description="Optional customer phone number for SMS notifications")

class IntakeResponse(BaseModel):
    ticket_id: str
    ticket_number: str
    priority_score: int
    predicted_wait_mins: float
    display_range: str
    relative_error_pct: float = Field(default=8.5, description="Model uncertainty percentage")
    queuing_theory_baseline_mins: Optional[float] = None
    extracted_features: Optional[Dict[str, Any]] = None
    created_at: datetime
