import os
import logging
from typing import Optional, Dict, Any, List
from supabase import create_client, Client

logger = logging.getLogger(__name__)

# Retrieve environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
# Prioritize service role key for privileged backend operations, falling back to anon key
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")

# In-memory fallback stores for offline development / placeholder credentials
in_memory_tenants: Dict[str, Dict[str, Any]] = {
    "default": {
        "id": "00000000-0000-0000-0000-000000000001",
        "business_id": "default",
        "industry": "General Service",
        "ai_persona": "general customer service desk",
        "active_counters": 2,
        "base_service_time_mins": 12.0
    },
    "metro_urgent_care": {
        "id": "00000000-0000-0000-0000-000000000002",
        "business_id": "metro_urgent_care",
        "industry": "Healthcare",
        "ai_persona": "hospital emergency intake and triage desk",
        "active_counters": 3,
        "base_service_time_mins": 15.0
    }
}

in_memory_queue: Dict[str, Dict[str, Any]] = {}

def _init_supabase() -> Optional[Client]:
    """Initializes the global Supabase client singleton."""
    if not SUPABASE_URL or not SUPABASE_KEY or "placeholder" in SUPABASE_URL:
        logger.warning("[database] SUPABASE_URL or SUPABASE_KEY is missing or placeholder. Running in fallback mode.")
        return None
    try:
        client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("[database] Supabase client singleton connected successfully.")
        return client
    except Exception as e:
        logger.error(f"[database] Error initializing Supabase client ({e}). Using in-memory store.")
        return None

# Exported singleton instance
supabase: Optional[Client] = _init_supabase()

def get_supabase() -> Optional[Client]:
    """Provides lazy access to the Supabase client singleton."""
    global supabase
    if supabase is None:
        supabase = _init_supabase()
    return supabase
