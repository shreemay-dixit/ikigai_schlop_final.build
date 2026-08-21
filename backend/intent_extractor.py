import os
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

class QueueIntent(BaseModel):
    """
    Structured feature schema extracted from unstructured user intake text,
    formatted directly for downstream Scikit-Learn regression and queuing models.
    """
    service_type: int = Field(
        default=1,
        description=(
            "Categorize the user service request tier: "
            "0 = Routine / Quick Task (e.g. quick drop-off, balance check, address change, routine query), "
            "1 = Standard Consultation (e.g. general advisory, doctor consultation, standard vehicle registration, account opening), "
            "2 = Complex / Lengthy Procedure (e.g. loan approval, multi-step exam/surgery, commercial license test, complex dispute)."
        )
    )
    priority_score: int = Field(
        default=1,
        ge=1,
        le=5,
        description=(
            "Urgency rating from 1 to 5: "
            "1 = Lowest / Routine visit, "
            "2 = Low priority, "
            "3 = Moderate urgency, "
            "4 = High urgency (distressed, time-critical), "
            "5 = Critical / Immediate Triage (medical emergency, severe distress, urgent VIP dispatch)."
        )
    )
    is_walk_in: int = Field(
        default=1,
        ge=0,
        le=1,
        description="1 if the text implies an unannounced, spontaneous walk-in visit; 0 if referencing a pre-booked, scheduled, or reservation appointment."
    )
    party_size: int = Field(
        default=1,
        ge=1,
        description="Number of individuals needing service based on explicit or implied group mentions (e.g. 'with my 2 kids' -> 3, 'family of 4' -> 4, 'just me' -> 1)."
    )
    age_bracket: int = Field(
        default=1,
        ge=0,
        le=2,
        description="Age bracket: 0 for minors/youth (under 18), 1 for adults (18-60), 2 for senior citizens (60+ or elderly/pensioner terms)."
    )

SAFE_FALLBACK: Dict[str, int] = {
    "service_type": 1,
    "priority_score": 1,
    "is_walk_in": 1,
    "party_size": 1,
    "age_bracket": 1
}

_client: Optional[genai.Client] = None

def get_genai_client() -> Optional[genai.Client]:
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY environment variable is not set. Intent extraction will use safe fallback.")
            return None
        try:
            _client = genai.Client(api_key=api_key)
        except Exception as e:
            logger.error(f"Failed to initialize google-genai Client: {e}")
            return None
    return _client

def extract_queue_intent(user_text: str, tenant_persona: str = "general service desk") -> Dict[str, Any]:
    if not user_text or not user_text.strip():
        return SAFE_FALLBACK.copy()

    client = get_genai_client()
    if client is None:
        return SAFE_FALLBACK.copy()

    system_instruction = (
        f"You are an expert AI triage and intake assistant for a {tenant_persona}. "
        "Analyze the customer's raw input description and extract numerical queue classification features strictly adhering to the schema. "
        f"Contextualize priority ratings and task complexity according to typical {tenant_persona} workflows "
        "(e.g., severe chest pain or bleeding in a hospital is priority 5, standard DMV license renewal is service_type 1, fast cash deposit in bank is service_type 0)."
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_text,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.1,
                response_mime_type="application/json",
                response_schema=QueueIntent
            )
        )

        if response and response.parsed:
            if isinstance(response.parsed, QueueIntent):
                return response.parsed.model_dump()
            elif isinstance(response.parsed, dict):
                validated = QueueIntent(**response.parsed)
                return validated.model_dump()

        if response and response.text:
            validated = QueueIntent.model_validate_json(response.text)
            return validated.model_dump()

        return SAFE_FALLBACK.copy()

    except Exception as exc:
        logger.error(f"Error during Gemini intent extraction ({exc}); using graceful fallback.")
        return SAFE_FALLBACK.copy()
