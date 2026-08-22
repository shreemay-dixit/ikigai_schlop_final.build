import os
import json
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

# Primary and secondary SDK imports
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

try:
    from groq import Groq
except ImportError:
    Groq = None

# Configure logger
logger = logging.getLogger(__name__)

# =============================================================================
# Step 1: Define the Pydantic Target Schema
# =============================================================================
class QueueIntent(BaseModel):
    """
    Structured feature schema extracted from unstructured user intake text.
    Enforces uniform numerical classification for both LLM outputs and downstream ML pipelines.
    """
    service_type: int = Field(
        default=1,
        description=(
            "Categorize the user service request tier: "
            "0 = Routine / Quick Task (e.g., quick drop-off, document pickup, basic query, simple payment, balance check), "
            "1 = Standard Consultation (e.g., general doctor visit, vehicle registration renewal, standard account opening, standard advisory), "
            "2 = Complex / Lengthy Procedure (e.g., loan approval, specialized medical examination, commercial permit, complex dispute resolution)."
        )
    )
    priority_score: int = Field(
        default=1,
        ge=1,
        le=5,
        description=(
            "Urgency rating from 1 to 5: "
            "1 = Lowest / Routine scheduled visit, "
            "2 = Low priority, "
            "3 = Moderate urgency / distressed customer, "
            "4 = High urgency / time-critical request, "
            "5 = Critical / Immediate Triage (medical emergency, severe pain, bleeding, urgent VIP dispatch)."
        )
    )
    is_walk_in: int = Field(
        default=1,
        ge=0,
        le=1,
        description=(
            "Arrival type: "
            "1 if text implies an unannounced, spontaneous physical walk-in arrival; "
            "0 if explicitly referencing a pre-booked, scheduled appointment, booking, or reservation."
        )
    )
    party_size: int = Field(
        default=1,
        ge=1,
        description=(
            "Total number of individuals needing service based on group mentions "
            "(e.g., 'with my 2 kids' -> 3, 'family of 4' -> 4, 'my husband and I' -> 2, 'just me' -> 1). Default to 1."
        )
    )
    age_bracket: int = Field(
        default=1,
        ge=0,
        le=2,
        description=(
            "Demographic age group: "
            "0 for minors/youth (under 18 years old, child, pediatric), "
            "1 for adults (18-60 years old), "
            "2 for senior citizens (60+ years old, elderly, pensioner, geriatric). Default to 1."
        )
    )

# Hardcoded safe fallback values (Tier 3)
SAFE_FALLBACK: Dict[str, Any] = {
    "service_type": 1,
    "priority_score": 1,
    "is_walk_in": 1,
    "party_size": 1,
    "age_bracket": 1
}

# =============================================================================
# Step 2: Client Initialization & Error Handling
# =============================================================================
gemini_client: Optional[Any] = None
groq_client: Optional[Any] = None

# Initialize Google GenAI client globally
try:
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and genai is not None:
        gemini_client = genai.Client(api_key=gemini_key)
    else:
        logger.warning("[ai_engine] GEMINI_API_KEY not set or google-genai SDK not available. Gemini client not initialized.")
except Exception as e:
    logger.warning(f"[ai_engine] Failed to initialize Google GenAI client: {e}")
    gemini_client = None

# Initialize Groq client globally
try:
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key and Groq is not None:
        groq_client = Groq(api_key=groq_key)
    else:
        logger.warning("[ai_engine] GROQ_API_KEY not set or groq SDK not available. Groq client not initialized.")
except Exception as e:
    logger.warning(f"[ai_engine] Failed to initialize Groq client: {e}")
    groq_client = None

# Lazy getters to pick up runtime environment variable updates
def get_gemini_client() -> Optional[Any]:
    global gemini_client
    if gemini_client is None and genai is not None:
        k = os.getenv("GEMINI_API_KEY")
        if k:
            try:
                gemini_client = genai.Client(api_key=k)
            except Exception as e:
                logger.warning(f"[ai_engine] Lazy Gemini init failed: {e}")
    return gemini_client

def get_groq_client() -> Optional[Any]:
    global groq_client
    if groq_client is None and Groq is not None:
        k = os.getenv("GROQ_API_KEY")
        if k:
            try:
                groq_client = Groq(api_key=k)
            except Exception as e:
                logger.warning(f"[ai_engine] Lazy Groq init failed: {e}")
    return groq_client

# =============================================================================
# Step 3: Primary Engine (Gemini)
# =============================================================================
def _extract_with_gemini(user_text: str, tenant_persona: str) -> QueueIntent:
    """
    Tier 1 extraction using google-genai SDK targeting gemini-2.5-flash
    with strict Pydantic structured outputs.
    """
    client = get_gemini_client()
    if client is None:
        raise RuntimeError("Google GenAI client is not configured or unavailable.")

    system_instruction = (
        f"You are an expert AI triage and intake assistant for a {tenant_persona}. "
        "Analyze the customer's raw input description and extract numerical queue classification features strictly adhering to the schema. "
        f"Contextualize priority ratings and task complexity according to typical {tenant_persona} workflows "
        "(e.g., severe chest pain or bleeding in a hospital is priority 5; routine DMV license renewal is service_type 1; quick document drop-off is service_type 0)."
    )

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
            return response.parsed
        elif isinstance(response.parsed, dict):
            return QueueIntent(**response.parsed)

    if response and response.text:
        return QueueIntent.model_validate_json(response.text)

    raise ValueError("Gemini returned an empty response.")

# =============================================================================
# Step 4: Secondary Engine (Groq Fallback)
# =============================================================================
def _extract_with_groq(user_text: str, tenant_persona: str) -> QueueIntent:
    """
    Tier 2 secondary fallback extraction using groq SDK targeting llama-3.3-70b-versatile
    with JSON mode and explicit schema injection.
    """
    client = get_groq_client()
    if client is None:
        raise RuntimeError("Groq client is not configured or unavailable.")

    # Convert Pydantic schema to JSON schema string
    json_schema_str = json.dumps(QueueIntent.model_json_schema(), indent=2)

    system_prompt = (
        f"You are an expert AI triage and intake assistant for a {tenant_persona}. "
        "Analyze the customer's raw input text and extract structured queue classification features. "
        f"Output ONLY valid JSON strictly adhering to this JSON Schema:\n{json_schema_str}\n"
        "Do not include any explanation or markdown wrapping outside the raw JSON object."
    )

    chat_completion = client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text}
        ],
        model="llama-3.3-70b-versatile",
        temperature=0.1,
        response_format={"type": "json_object"}
    )

    raw_json_str = chat_completion.choices[0].message.content
    if not raw_json_str:
        raise ValueError("Groq returned empty content.")

    return QueueIntent.model_validate_json(raw_json_str)

# =============================================================================
# Step 5: Master Orchestration Pipeline
# =============================================================================
def parse_user_intent(user_text: str, tenant_persona: str = "general customer service desk") -> Dict[str, Any]:
    """
    Master 3-tier resilient intent extraction pipeline:
    - Tier 1: Gemini 2.5 Flash via google-genai structured outputs
    - Tier 2: Llama 3.3 70B via Groq JSON mode
    - Tier 3: Hardcoded deterministic safety baseline
    """
    if not user_text or not user_text.strip():
        logger.info("[ai_engine] Empty user text received; returning hardcoded fallback.")
        fallback = SAFE_FALLBACK.copy()
        fallback["extracted_by"] = "hardcoded_fallback"
        return fallback

    # -------------------------------------------------------------------------
    # Tier 1: Primary Extraction (Gemini)
    # -------------------------------------------------------------------------
    try:
        intent_obj = _extract_with_gemini(user_text, tenant_persona)
        result = intent_obj.model_dump()
        result["extracted_by"] = "gemini"
        logger.info(f"[ai_engine] Extracted intent using Gemini: {result}")
        return result
    except Exception as gemini_err:
        logger.warning(f"[ai_engine] Tier 1 (Gemini) failed: {gemini_err}. Attempting Tier 2 (Groq)...")

    # -------------------------------------------------------------------------
    # Tier 2: Secondary Fallback (Groq)
    # -------------------------------------------------------------------------
    try:
        intent_obj = _extract_with_groq(user_text, tenant_persona)
        result = intent_obj.model_dump()
        result["extracted_by"] = "groq"
        logger.info(f"[ai_engine] Extracted intent using Groq fallback: {result}")
        return result
    except Exception as groq_err:
        logger.error(f"[ai_engine] Tier 2 (Groq) failed: {groq_err}. Falling back to Tier 3 hardcoded safety net.", exc_info=True)

    # -------------------------------------------------------------------------
    # Tier 3: Tertiary Hardcoded Safety Net
    # -------------------------------------------------------------------------
    fallback = SAFE_FALLBACK.copy()
    fallback["extracted_by"] = "hardcoded_fallback"
    logger.warning(f"[ai_engine] Using Tier 3 hardcoded fallback: {fallback}")
    return fallback
