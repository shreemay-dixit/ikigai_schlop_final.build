import time
import logging
from datetime import datetime
from collections import deque
from threading import Lock
from typing import Dict, Any, Optional

from app.database import supabase, in_memory_tenants, in_memory_queue

logger = logging.getLogger(__name__)

class BusinessVelocityTracker:
    """
    In-memory velocity tracker recording sliding-window arrival timestamps and
    rolling service duration averages for fast <1ms access.
    """
    def __init__(self, window_minutes: float = 15.0, rolling_k: int = 5):
        self.window_seconds = window_minutes * 60.0
        self.rolling_k = rolling_k
        self.lock = Lock()
        self.arrivals: Dict[str, deque] = {}
        self.durations: Dict[str, deque] = {}

    def record_arrival(self, business_id: str, timestamp: Optional[float] = None) -> None:
        t = timestamp if timestamp is not None else time.time()
        with self.lock:
            if business_id not in self.arrivals:
                self.arrivals[business_id] = deque()
            self.arrivals[business_id].append(t)
            self._purge(business_id, t)

    def record_completion_duration(self, business_id: str, duration_mins: float) -> None:
        with self.lock:
            if business_id not in self.durations:
                self.durations[business_id] = deque()
            self.durations[business_id].append(max(2.0, min(45.0, float(duration_mins))))
            if len(self.durations[business_id]) > self.rolling_k:
                self.durations[business_id].popleft()

    def _purge(self, business_id: str, now: float) -> None:
        cutoff = now - self.window_seconds
        q = self.arrivals.get(business_id)
        if q:
            while q and q[0] < cutoff:
                q.popleft()

    def get_arrival_rate(self, business_id: str) -> float:
        now = time.time()
        with self.lock:
            self._purge(business_id, now)
            q = self.arrivals.get(business_id)
            count = len(q) if q else 0
            if count == 0:
                return 0.35
            return max(0.05, count / (self.window_seconds / 60.0))

    def get_rolling_velocity(self, business_id: str, default_val: float = 12.0) -> float:
        with self.lock:
            d = self.durations.get(business_id)
            if not d:
                return default_val
            return float(sum(d) / len(d))

velocity_tracker = BusinessVelocityTracker()

# =============================================================================
# Task 1: The Rolling Velocity Background Worker
# =============================================================================
def recalculate_rolling_velocity(business_id: str, db_client=None):
    """
    Background worker that recalculates the rolling average service time from the
    last 5 completed records and updates the business's base_service_time_mins in
    the tenants table dynamically.

    Bounds: Clamped to [2.0, 45.0] minutes to eliminate outliers and forgotten tickets.
    """
    client = db_client if db_client is not None else supabase
    durations = []

    if client:
        try:
            # Query last 5 completed queue_entries for this business
            # Filtering by tenant_id = business_id or business_id = business_id
            resp = client.table("queue_entries") \
                .select("served_at, completed_at") \
                .or_(f"tenant_id.eq.{business_id},business_id.eq.{business_id}") \
                .eq("status", "completed") \
                .not_.is_("served_at", "null") \
                .not_.is_("completed_at", "null") \
                .order("completed_at", desc=True) \
                .limit(5) \
                .execute()

            if resp.data and len(resp.data) > 0:
                for row in resp.data:
                    try:
                        t_served_raw = row["served_at"]
                        t_comp_raw = row["completed_at"]
                        t_served = datetime.fromisoformat(str(t_served_raw).replace("Z", "+00:00"))
                        t_comp = datetime.fromisoformat(str(t_comp_raw).replace("Z", "+00:00"))
                        duration_mins = (t_comp - t_served).total_seconds() / 60.0
                        durations.append(duration_mins)
                    except Exception as parse_err:
                        logger.warning(f"[velocity_worker] Error parsing row timestamp: {parse_err}")

        except Exception as query_err:
            logger.error(f"[velocity_worker] Supabase query error ({query_err}); checking in-memory store.")

    # Fallback to in-memory store if DB had no records or was offline
    if not durations:
        completed = [
            e for e in in_memory_queue.values()
            if (e.get("business_id") == business_id or e.get("tenant_id") == business_id)
            and e.get("status") == "completed"
            and e.get("served_at") is not None
            and e.get("completed_at") is not None
        ]
        completed.sort(key=lambda x: x["completed_at"], reverse=True)
        for e in completed[:5]:
            try:
                t_comp = e["completed_at"] if isinstance(e["completed_at"], datetime) else datetime.fromisoformat(str(e["completed_at"]).replace("Z", "+00:00"))
                t_serv = e["served_at"] if isinstance(e["served_at"], datetime) else datetime.fromisoformat(str(e["served_at"]).replace("Z", "+00:00"))
                duration_mins = (t_comp - t_serv).total_seconds() / 60.0
                durations.append(duration_mins)
            except Exception as e_err:
                logger.warning(f"[velocity_worker] Error calculating in-memory delta: {e_err}")

    # If durations were found, compute mean and clamp to [2.0, 45.0]
    if durations:
        calculated_mean = float(sum(durations) / len(durations))
        # Apply bounds: clamp between 2.0 and 45.0 minutes
        clamped_mean = round(max(2.0, min(45.0, calculated_mean)), 2)
        
        # Update in-memory tracker cache
        velocity_tracker.record_completion_duration(business_id, clamped_mean)

        # Update the tenants table in the database
        if client:
            try:
                client.table("tenants") \
                    .update({"base_service_time_mins": clamped_mean}) \
                    .eq("business_id", business_id) \
                    .execute()
                logger.info(f"[velocity_worker] Updated base_service_time_mins for {business_id} to {clamped_mean} mins in tenants table.")
            except Exception as update_err:
                logger.error(f"[velocity_worker] Failed to update tenants table: {update_err}")

        # Update in-memory tenant store
        if business_id in in_memory_tenants:
            in_memory_tenants[business_id]["base_service_time_mins"] = clamped_mean
            logger.info(f"[velocity_worker] Updated in-memory tenant {business_id} base_service_time_mins to {clamped_mean} mins.")
