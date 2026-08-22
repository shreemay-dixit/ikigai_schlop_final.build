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
        "business_name": "General Service Center",
        "industry": "General Service",
        "ai_persona": "General customer service and intake desk.",
        "urgency_guidelines": "Standard triage from routine (1) to emergency (5).",
        "active_counters": 2,
        "base_service_time_mins": 12.0
    },
    "metro_urgent_care": {
        "id": "00000000-0000-0000-0000-000000000002",
        "business_id": "metro_urgent_care",
        "business_name": "Metro Urgent Care Clinic",
        "industry": "Healthcare",
        "ai_persona": "Hospital Emergency Triage and Walk-in Clinic Intake Desk.",
        "urgency_guidelines": "Priority 5 = Severe life-threatening emergency, acute chest pain, anaphylaxis, severe breathing difficulty, profuse bleeding. Priority 4 = High fever with distress, acute fractures. Priority 3 = Moderate pain, cuts needing stitches. Priority 2 = Persistent cold/cough. Priority 1 = Routine checkup or prescription refill.",
        "active_counters": 3,
        "base_service_time_mins": 15.0
    },
    "apex_commercial_bank": {
        "id": "00000000-0000-0000-0000-000000000003",
        "business_id": "apex_commercial_bank",
        "business_name": "Apex Commercial Bank",
        "industry": "Banking",
        "ai_persona": "Commercial and Retail Banking Branch Reception & Wealth Advisory Desk.",
        "urgency_guidelines": "Priority 5 = Wire fraud, compromised business accounts, critical identity theft. Priority 4 = High Net Worth VIP commercial lending & time-sensitive escrow closing. Priority 3 = Loan consultation, new commercial business account. Priority 2 = Standard checking/savings advisory. Priority 1 = Routine cash/check deposit or ATM balance inquiry.",
        "active_counters": 4,
        "base_service_time_mins": 10.0
    },
    "golden_bistro": {
        "id": "00000000-0000-0000-0000-000000000004",
        "business_id": "golden_bistro",
        "business_name": "Golden Bistro & Lounge",
        "industry": "Hospitality / Restaurant",
        "ai_persona": "Fine Dining & Bistro Hostess Table Seating Desk.",
        "urgency_guidelines": "Priority 5 = VIP guests, pre-paid large banquets, event host arrivals. Priority 4 = Celebrations (anniversary, birthdays) & confirmed advance reservations. Priority 3 = Standard walk-in table of 4-6. Priority 2 = Standard walk-in party of 2. Priority 1 = Bar seating, single walk-in, takeout pickup.",
        "active_counters": 6,
        "base_service_time_mins": 25.0
    },
    "city_dmv": {
        "id": "00000000-0000-0000-0000-000000000005",
        "business_id": "city_dmv",
        "business_name": "City Department of Motor Vehicles",
        "industry": "Government Services",
        "ai_persona": "Municipal Motor Vehicle & Public Licensing Service Center.",
        "urgency_guidelines": "Priority 5 = ADA accessibility assistance, medical transport driver triage. Priority 4 = Commercial driver license (CDL) urgent renewals, court-ordered reinstatements. Priority 3 = Driving skill tests, vehicle title disputes. Priority 2 = Standard driver license renewals. Priority 1 = Routine plate pickup, document drop-off, address update.",
        "active_counters": 5,
        "base_service_time_mins": 8.0
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
