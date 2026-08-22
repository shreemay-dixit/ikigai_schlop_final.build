import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from app.config import settings

logger = logging.getLogger(__name__)

class QueueIntent(BaseModel):
    """
    Structured feature schema extracted from unstructured user intake text.
    """
    service_type: int = Field(
        default=1,
        description="0 = Quick / Routine Task (~6 mins), 1 = Standard Consultation (~14 mins), 2 = Complex Procedure (~28 mins)"
    )
    priority_score: int = Field(
        default=1,
        ge=1,
        le=5,
        description="Urgency rating: 1 (Routine) to 5 (Critical Emergency / VIP Triage)"
    )
    is_walk_in: int = Field(
        default=1,
        ge=0,
        le=1,
        description="1 for unannounced spontaneous walk-in, 0 for scheduled appointment"
    )
    party_size: int = Field(
        default=1,
        ge=1,
        description="Total number of people in party"
    )
    age_bracket: int = Field(
        default=1,
        ge=0,
        le=2,
        description="0 for minors (<18), 1 for adults (18-60), 2 for seniors (60+)"
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
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            logger.warning("[ai_engine] GEMINI_API_KEY not set. Using safe fallback.")
            return None
        try:
            _client = genai.Client(api_key=api_key)
        except Exception as e:
            logger.error(f"[ai_engine] Failed to initialize google-genai Client: {e}")
            return None
    return _client

def parse_user_intent(user_text: str, tenant_persona: str = "general customer service desk") -> Dict[str, Any]:
    """
    Uses Gemini 2.5 Flash Structured Outputs to extract structured features from raw text.
    Gracefully degrades to SAFE_FALLBACK upon timeout or quota limits.
    """
    if not user_text or not user_text.strip():
        return SAFE_FALLBACK.copy()

    client = get_genai_client()
    if client is None:
        return SAFE_FALLBACK.copy()

    system_instruction = (
        f"You are an expert AI triage and intake assistant for a {tenant_persona}. "
        "Analyze the customer's raw input description and extract numerical queue classification features strictly adhering to the schema. "
        f"Contextualize priority ratings and task complexity according to typical {tenant_persona} workflows."
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
                return QueueIntent(**response.parsed).model_dump()

        if response and response.text:
            return QueueIntent.model_validate_json(response.text).model_dump()

        return SAFE_FALLBACK.copy()

    except Exception as exc:
        logger.error(f"[ai_engine] Gemini triage error ({exc}); using safe fallback.")
        return SAFE_FALLBACK.copy()
