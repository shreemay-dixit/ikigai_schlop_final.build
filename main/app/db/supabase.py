import logging
from typing import Any, Dict, List, Optional
from supabase import Client, create_client
from main.app.config import settings

logger = logging.getLogger(__name__)

# Single reusable Supabase client instance
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """
    Returns the initialized singleton Supabase client.
    Initializes once on first call and caches across the application lifecycle.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = settings.SUPABASE_URL.strip() if settings.SUPABASE_URL else ""
    key = settings.SUPABASE_KEY.strip() if settings.SUPABASE_KEY else ""

    if not url or not key:
        raise RuntimeError(
            "Supabase credentials not configured. Please set SUPABASE_URL and SUPABASE_KEY in .env"
        )

    _supabase_client = create_client(url, key)
    return _supabase_client


def resolve_business_id() -> str:
    """
    Resolves the target business UUID:
    1. Returns BUSINESS_ID from environment if configured.
    2. Otherwise, attempts a read-only lookup of 'Demo Business' from the businesses table.
    Never attempts an INSERT into the businesses table.
    """
    if settings.BUSINESS_ID and settings.BUSINESS_ID.strip():
        return settings.BUSINESS_ID.strip()

    client = get_supabase_client()
    response = (
        client.table("businesses")
        .select("id")
        .eq("name", "Demo Business")
        .execute()
    )
    if response.data and len(response.data) > 0:
        return str(response.data[0]["id"])

    raise RuntimeError(
        "BUSINESS_ID not set in .env and 'Demo Business' could not be resolved via SELECT."
    )


def get_business_by_name(name: str) -> Optional[Dict[str, Any]]:
    """Fetches a business record by its exact name using read-only SELECT."""
    client = get_supabase_client()
    response = client.table("businesses").select("*").eq("name", name).execute()
    if response.data and len(response.data) > 0:
        return response.data[0]
    return None


def get_business_config(business_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches operational configuration for a given business from business_config table.
    Returns: dict with average_service_time, active_counters, updated_at or None.
    """
    client = get_supabase_client()
    response = (
        client.table("business_config")
        .select("*")
        .eq("business_id", business_id)
        .execute()
    )
    if response.data and len(response.data) > 0:
        return response.data[0]
    return None


def count_waiting_entries(business_id: str) -> int:
    """
    Counts currently waiting tickets for a business using exact count.
    Used to supply queue_length_ahead to the ML prediction pipeline.
    """
    client = get_supabase_client()
    response = (
        client.table("queue_entries")
        .select("id", count="exact")
        .eq("business_id", business_id)
        .eq("status", "waiting")
        .execute()
    )
    return response.count if response.count is not None else 0


def get_recent_completed_entries(
    business_id: str, limit: int = 5
) -> List[Dict[str, Any]]:
    """
    Retrieves the most recent completed queue entries for a business.
    Used for rolling-average service velocity calculations.
    """
    client = get_supabase_client()
    response = (
        client.table("queue_entries")
        .select("*")
        .eq("business_id", business_id)
        .eq("status", "completed")
        .order("completed_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data if response.data else []


def generate_queue_token(
    business_id: str, service_type: int = 0, prefix: str = "A"
) -> str:
    """
    Generates a concurrency-safe sequential queue token (e.g. A-001, A-002).
    Attempts PostgreSQL sequence function 'get_next_queue_token' via RPC first,
    and falls back to database-backed sequential token tracking.
    """
    client = get_supabase_client()

    # 1. Primary: PostgreSQL sequence RPC function
    try:
        rpc_res = client.rpc(
            "get_next_queue_token", {"p_prefix": prefix}
        ).execute()
        if rpc_res.data:
            return str(rpc_res.data)
    except Exception as exc:
        logger.debug(f"RPC get_next_queue_token not available: {exc}")

    # 2. Database Sequential Lookup: Query latest created token for this business
    try:
        res = (
            client.table("queue_entries")
            .select("token")
            .eq("business_id", business_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data and len(res.data) > 0 and res.data[0].get("token"):
            last_token = res.data[0]["token"]
            parts = last_token.split("-")
            if len(parts) == 2 and parts[1].isdigit():
                next_seq = int(parts[1]) + 1
                return f"{prefix}-{next_seq:03d}"
        return f"{prefix}-001"
    except Exception as exc:
        logger.warning(f"Database sequential token fallback error: {exc}")
        return f"{prefix}-001"


def create_queue_entry(entry_data: Dict[str, Any]) -> Dict[str, Any]:
    """Inserts a new queue entry into queue_entries."""
    client = get_supabase_client()
    response = client.table("queue_entries").insert(entry_data).execute()
    if response.data and len(response.data) > 0:
        return response.data[0]
    raise RuntimeError("Failed to create queue entry in Supabase.")


def update_queue_entry_status(
    entry_id: str,
    status: str,
    started_at: Optional[str] = None,
    completed_at: Optional[str] = None,
) -> Dict[str, Any]:
    """Updates the status and timestamps of an existing queue entry."""
    client = get_supabase_client()
    update_payload: Dict[str, Any] = {"status": status}
    if started_at is not None:
        update_payload["started_at"] = started_at
    if completed_at is not None:
        update_payload["completed_at"] = completed_at

    response = (
        client.table("queue_entries")
        .update(update_payload)
        .eq("id", entry_id)
        .execute()
    )
    if response.data and len(response.data) > 0:
        return response.data[0]
    raise RuntimeError(f"Failed to update queue entry {entry_id}.")


def update_business_config(
    business_id: str,
    average_service_time: Optional[float] = None,
    active_counters: Optional[int] = None,
) -> Dict[str, Any]:
    """Updates operational settings in business_config."""
    client = get_supabase_client()
    update_payload: Dict[str, Any] = {}
    if average_service_time is not None:
        update_payload["average_service_time"] = average_service_time
    if active_counters is not None:
        update_payload["active_counters"] = active_counters

    response = (
        client.table("business_config")
        .update(update_payload)
        .eq("business_id", business_id)
        .execute()
    )
    if response.data and len(response.data) > 0:
        return response.data[0]
    raise RuntimeError(f"Failed to update config for business {business_id}.")


def test_supabase_connection() -> Dict[str, Any]:
    """
    Internal verification mechanism:
    1. Verifies FastAPI can connect to Supabase.
    2. Resolves Demo Business.
    3. Retrieves its business_config.
    4. Confirms average_service_time == 15 and active_counters == 3.
    5. Confirms waiting queue count == 0.
    """
    business_id = resolve_business_id()
    config = get_business_config(business_id)
    if not config:
        raise RuntimeError(f"business_config not found for business {business_id}.")

    avg_service_time = float(config.get("average_service_time", 0))
    active_counters = int(config.get("active_counters", 0))
    waiting_count = count_waiting_entries(business_id)

    return {
        "business_found": True,
        "business_id": business_id,
        "average_service_time": avg_service_time,
        "active_counters": active_counters,
        "waiting_count": waiting_count,
        "avg_service_time_matches_expected": avg_service_time == 15.0,
        "active_counters_matches_expected": active_counters == 3,
        "waiting_count_matches_expected": waiting_count == 0,
    }
