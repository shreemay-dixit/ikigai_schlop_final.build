import logging
from typing import Optional
from supabase import create_client, Client
from app.config import settings

logger = logging.getLogger(__name__)

_supabase_client: Optional[Client] = None

def get_supabase_client() -> Optional[Client]:
    """
    Singleton Supabase client instance reusing HTTP connection pools.
    Gracefully degrades if credentials are placeholder/unset.
    """
    global _supabase_client
    if _supabase_client is None:
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
        if not settings.SUPABASE_URL or not key or "placeholder" in settings.SUPABASE_URL:
            logger.warning("[database] Supabase credentials not configured or placeholder. Using in-memory fallback store.")
            return None
        try:
            _supabase_client = create_client(settings.SUPABASE_URL, key)
            logger.info("[database] Supabase client successfully initialized.")
        except Exception as e:
            logger.error(f"[database] Failed to initialize Supabase client: {e}")
            _supabase_client = None
    return _supabase_client

# In-memory fallback stores for local testing / offline state
in_memory_tenants = {
    "default": {
        "business_id": "default",
        "industry": "General Service",
        "ai_persona": "general customer service desk",
        "active_counters": 2,
        "base_service_time": 12.0
    }
}

in_memory_queue = {}
