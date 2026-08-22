import os
import json
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

from app.config import settings

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
# Step 1: Define the Universal Pydantic Target Schema
# =============================================================================
class QueueIntent(BaseModel):
    """
    Universal 5-factor mathematical feature vector extracted from unstructured user text.
    Agnostic to any industry (Healthcare, Banking, Restaurant, DMV, Retail).
    """
    service_type: int = Field(
        default=1,
        ge=0,
        le=2,
        description=(
            "Universal complexity tier of the requested service: "
            "0 = Routine / Quick Task (e.g., Quick check deposit, bar/takeout pickup, license renewal pickup, routine query), "
            "1 = Standard Consultation (e.g., General doctor consult, account advisory, standard dining table, driving test), "
            "2 = Complex / Lengthy Procedure (e.g., Emergency medical procedure, commercial loan/mortgage approval, large banquet seating, complex title dispute)."
        )
    )
    priority_score: int = Field(
        default=1,
        ge=1,
        le=5,
        description=(
            "Universal urgency and priority tier from 1 to 5 based on tenant urgency guidelines: "
            "1 = Lowest / Routine scheduled visit / Quick drop-off, "
            "2 = Low priority / Standard walk-in, "
            "3 = Moderate urgency / Standard advisory or table, "
            "4 = High urgency / VIP triage / Confirmed special celebration / Urgent commercial matter, "
            "5 = Critical / Immediate Triage (Severe life-threatening emergency, wire fraud, ADA express assistance)."
        )
    )
    is_walk_in: int = Field(
        default=1,
        ge=0,
        le=1,
        description=(
            "Arrival type: "
            "1 if the text implies an unannounced, spontaneous physical walk-in arrival; "
            "0 if explicitly referencing a pre-booked reservation, scheduled appointment, or advance booking."
        )
    )
    party_size: int = Field(
        default=1,
        ge=1,
        description=(
            "Total number of individuals needing service based on group mentions "
            "(e.g., 'Table for 6' -> 6, 'with my 2 kids' -> 3, 'family of 4' -> 4, 'my husband and I' -> 2, 'just me' -> 1). Default to 1."
        )
    )
    age_bracket: int = Field(
        default=1,
        ge=0,
        le=2,
        description=(
            "Demographic age group: "
            "0 for minors/youth (under 18 years old, child, infant, pediatric, student), "
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

def _get_gemini_api_key() -> Optional[str]:
    return getattr(settings, "GEMINI_API_KEY", "") or os.getenv("GEMINI_API_KEY")

def _get_groq_api_key() -> Optional[str]:
    return getattr(settings, "GROQ_API_KEY", "") or os.getenv("GROQ_API_KEY")

# Initialize Google GenAI client globally
try:
    gemini_key = _get_gemini_api_key()
    if gemini_key and genai is not None:
        gemini_client = genai.Client(api_key=gemini_key)
    else:
        logger.warning("[ai_engine] GEMINI_API_KEY not set or google-genai SDK not available.")
except Exception as e:
    logger.warning(f"[ai_engine] Failed to initialize Google GenAI client: {e}")
    gemini_client = None

# Initialize Groq client globally
try:
    groq_key = _get_groq_api_key()
    if groq_key and Groq is not None:
        groq_client = Groq(api_key=groq_key)
    else:
        logger.warning("[ai_engine] GROQ_API_KEY not set or groq SDK not available.")
except Exception as e:
    logger.warning(f"[ai_engine] Failed to initialize Groq client: {e}")
    groq_client = None

# Lazy getters to pick up runtime environment variable updates
def get_gemini_client() -> Optional[Any]:
    global gemini_client
    if gemini_client is None and genai is not None:
        k = _get_gemini_api_key()
        if k:
            try:
                gemini_client = genai.Client(api_key=k)
            except Exception as e:
                logger.warning(f"[ai_engine] Lazy Gemini init failed: {e}")
    return gemini_client

def get_groq_client() -> Optional[Any]:
    global groq_client
    if groq_client is None and Groq is not None:
        k = _get_groq_api_key()
        if k:
            try:
                groq_client = Groq(api_key=k)
            except Exception as e:
                logger.warning(f"[ai_engine] Lazy Groq init failed: {e}")
    return groq_client

def build_dynamic_system_prompt(tenant_info: Dict[str, Any]) -> str:
    """
    Constructs an agnostic dynamic system prompt injecting the tenant's specific persona,
    business name, industry, and explicit urgency guidelines without any hardcoded rules.
    """
    business_name = tenant_info.get("business_name") or tenant_info.get("business_id", "Service Center")
    industry = tenant_info.get("industry", "General Services")
    ai_persona = tenant_info.get("ai_persona", "Universal customer service and intake desk.")
    urgency_guidelines = tenant_info.get("urgency_guidelines", "")

    prompt = (
        f"You are a universal intake triage agent for {business_name} ({industry}).\n"
        f"Industry Context: {ai_persona}\n"
    )
    if urgency_guidelines:
        prompt += f"Urgency Rules: {urgency_guidelines}\n"

    prompt += (
        "Map the user's natural language input into the structured QueueIntent schema strictly. "
        "Adhere to the universal mapping rules for service_type, priority_score, is_walk_in, party_size, and age_bracket."
    )
    return prompt

# Supported Gemini models in priority order
GEMINI_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"]

# =============================================================================
# Step 3: Primary Engine (Gemini)
# =============================================================================
def _extract_with_gemini(user_text: str, tenant_info: Dict[str, Any]) -> QueueIntent:
    """
    Tier 1 extraction using google-genai SDK targeting Gemini models
    with dynamic system instructions and strict Pydantic structured outputs.
    """
    client = get_gemini_client()
    if client is None:
        raise RuntimeError("Google GenAI client is not configured or unavailable.")

    system_instruction = build_dynamic_system_prompt(tenant_info)

    last_err = None
    for model_name in GEMINI_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
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
        except Exception as e:
            last_err = e
            logger.warning(f"[ai_engine] Gemini model {model_name} failed: {e}. Trying fallback model...")

    raise last_err or ValueError("Gemini returned an empty response.")

# =============================================================================
# Step 4: Secondary Engine (Groq Fallback)
# =============================================================================
def _extract_with_groq(user_text: str, tenant_info: Dict[str, Any]) -> QueueIntent:
    """
    Tier 2 secondary fallback extraction using groq SDK targeting llama-3.3-70b-versatile
    with JSON mode and dynamic schema injection.
    """
    client = get_groq_client()
    if client is None:
        raise RuntimeError("Groq client is not configured or unavailable.")

    json_schema_str = json.dumps(QueueIntent.model_json_schema(), indent=2)
    base_prompt = build_dynamic_system_prompt(tenant_info)
    
    system_prompt = (
        f"{base_prompt}\n"
        f"Output ONLY valid JSON strictly adhering to this JSON Schema:\n{json_schema_str}\n"
        "Do not include any markdown formatting, explanations, or extra text."
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
def parse_user_intent(user_text: str, tenant_context: Any = "general customer service desk") -> Dict[str, Any]:
    """
    Master 3-tier resilient intent extraction pipeline:
    - Tier 1: Gemini 2.5 Flash via google-genai structured outputs
    - Tier 2: Llama 3.3 70B via Groq JSON mode
    - Tier 3: Hardcoded deterministic safety baseline

    Accepts tenant_context as either a dictionary of tenant fields or a string persona.
    """
    if isinstance(tenant_context, str):
        tenant_info = {
            "business_name": "Service Center",
            "industry": "General Services",
            "ai_persona": tenant_context,
            "urgency_guidelines": ""
        }
    elif isinstance(tenant_context, dict):
        tenant_info = tenant_context
    else:
        tenant_info = {
            "business_name": "Service Center",
            "industry": "General Services",
            "ai_persona": str(tenant_context),
            "urgency_guidelines": ""
        }

    if not user_text or not user_text.strip():
        logger.info("[ai_engine] Empty user text received; returning hardcoded fallback.")
        fallback = SAFE_FALLBACK.copy()
        fallback["extracted_by"] = "hardcoded_fallback"
        return fallback

    # -------------------------------------------------------------------------
    # Tier 1: Primary Extraction (Gemini)
    # -------------------------------------------------------------------------
    try:
        intent_obj = _extract_with_gemini(user_text, tenant_info)
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
        intent_obj = _extract_with_groq(user_text, tenant_info)
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
