import time
import logging
from collections import deque
from threading import Lock
from typing import Dict, Any, Optional
from app.database import get_supabase, in_memory_queue

logger = logging.getLogger(__name__)

class BusinessVelocityTracker:
    """
    Tracks sliding window arrival timestamps and rolling completed ticket durations per business.
    """
    def __init__(self, window_minutes: float = 15.0, rolling_k: int = 5):
        self.window_seconds = window_minutes * 60.0
        self.rolling_k = rolling_k
        self.lock = Lock()
        
        # business_id -> deque of timestamps
        self.arrivals: Dict[str, deque] = {}
        # business_id -> deque of duration_mins
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
            self.durations[business_id].append(max(0.5, float(duration_mins)))
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
                return 0.35 # Default ~1 every 3 mins
            return max(0.05, count / (self.window_seconds / 60.0))

    def get_rolling_velocity(self, business_id: str, default_val: float = 12.0) -> float:
        with self.lock:
            d = self.durations.get(business_id)
            if not d:
                return default_val
            return float(sum(d) / len(d))

velocity_tracker = BusinessVelocityTracker()

def recalculate_rolling_velocity(business_id: str):
    """
    FastAPI Background Worker: queries last 5 completed entries from Supabase
    (or memory fallback) and updates the in-memory rolling velocity cache.
    """
    client = get_supabase()
    if client:
        try:
            resp = client.table("queue_entries") \
                .select("served_at, completed_at") \
                .eq("business_id", business_id) \
                .eq("status", "completed") \
                .not_.is_("served_at", "null") \
                .not_.is_("completed_at", "null") \
                .order("completed_at", desc=True) \
                .limit(5) \
                .execute()

            if resp.data:
                for row in resp.data:
                    try:
                        from datetime import datetime
                        t_served = datetime.fromisoformat(row["served_at"].replace("Z", "+00:00"))
                        t_comp = datetime.fromisoformat(row["completed_at"].replace("Z", "+00:00"))
                        delta_mins = max(0.5, (t_comp - t_served).total_seconds() / 60.0)
                        velocity_tracker.record_completion_duration(business_id, delta_mins)
                    except Exception as parse_err:
                        logger.warning(f"[velocity_worker] Error parsing timestamps: {parse_err}")
                logger.info(f"[velocity_worker] Recalculated velocity for business {business_id}: {velocity_tracker.get_rolling_velocity(business_id)} mins")
        except Exception as e:
            logger.error(f"[velocity_worker] Supabase query error: {e}")
    else:
        # Check in-memory store
        completed = [
            e for e in in_memory_queue.values()
            if e.get("business_id") == business_id and e.get("status") == "completed" and e.get("served_at") and e.get("completed_at")
        ]
        for e in completed[:5]:
            try:
                from datetime import datetime
                t_comp = e["completed_at"] if isinstance(e["completed_at"], datetime) else datetime.fromisoformat(str(e["completed_at"]).replace("Z", "+00:00"))
                t_serv = e["served_at"] if isinstance(e["served_at"], datetime) else datetime.fromisoformat(str(e["served_at"]).replace("Z", "+00:00"))
                delta = max(0.5, (t_comp - t_serv).total_seconds() / 60.0)
                velocity_tracker.record_completion_duration(business_id, delta)
            except Exception as e_err:
                logger.warning(f"[velocity_worker] Delta calculation error: {e_err}")
