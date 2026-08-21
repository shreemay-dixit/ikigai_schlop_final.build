import time
from collections import deque
from threading import Lock
from typing import Dict, Any, Optional

class QueueMetricsTracker:
    """
    In-memory dynamic rate metrics tracker.
    Maintains sliding timestamp windows for:
      1. Arrivals (to compute lambda: arrivals / minute)
      2. Completions (to compute mu: completions / counter / minute)
      3. Durations of last completed tickets (to compute rolling S_bar)
    """
    def __init__(self, window_minutes: float = 15.0, rolling_k_durations: int = 5):
        self.window_seconds = window_minutes * 60.0
        self.rolling_k = rolling_k_durations
        
        self.arrival_timestamps = deque()
        self.completion_records = deque() # tuples of (timestamp, duration_mins)
        self.lock = Lock()
        
        # Default fallback values for cold-start
        self.default_service_time_mins = 12.0
        self.default_arrival_rate = 0.5 # 1 customer every 2 mins

    def record_arrival(self, timestamp: Optional[float] = None) -> None:
        """Records a customer arrival."""
        t = timestamp if timestamp is not None else time.time()
        with self.lock:
            self.arrival_timestamps.append(t)
            self._purge_old_records(t)

    def record_completion(self, duration_mins: float, timestamp: Optional[float] = None) -> None:
        """Records a served customer and their service duration."""
        t = timestamp if timestamp is not None else time.time()
        with self.lock:
            self.completion_records.append((t, max(0.5, float(duration_mins))))
            self._purge_old_records(t)

    def _purge_old_records(self, now: float) -> None:
        cutoff = now - self.window_seconds
        while self.arrival_timestamps and self.arrival_timestamps[0] < cutoff:
            self.arrival_timestamps.popleft()
        while self.completion_records and self.completion_records[0][0] < cutoff:
            self.completion_records.popleft()

    def get_arrival_rate(self, now: Optional[float] = None) -> float:
        """
        Returns arrival rate lambda (customers / minute) over sliding window.
        """
        curr = now if now is not None else time.time()
        with self.lock:
            self._purge_old_records(curr)
            count = len(self.arrival_timestamps)
            if count == 0:
                return self.default_arrival_rate
            window_mins = self.window_seconds / 60.0
            return max(0.01, count / window_mins)

    def get_rolling_service_duration(self) -> float:
        """
        Returns S_bar_rolling: rolling average service duration of last k completed tickets.
        """
        with self.lock:
            if not self.completion_records:
                return self.default_service_time_mins
            recent = list(self.completion_records)[-self.rolling_k:]
            durations = [r[1] for r in recent]
            return float(sum(durations) / len(durations))

    def get_service_rate_per_counter(self, active_counters: int = 1) -> float:
        """
        Returns service rate mu = 1 / S_bar_rolling (completions / counter / minute).
        """
        avg_duration = self.get_rolling_service_duration()
        return 1.0 / max(0.5, avg_duration)

    def get_metrics_snapshot(self, active_counters: int = 1) -> Dict[str, Any]:
        """Provides full instantaneous snapshot of dynamic queuing metrics."""
        now = time.time()
        lam = self.get_arrival_rate(now)
        s_bar = self.get_rolling_service_duration()
        mu = 1.0 / s_bar
        c = max(1, active_counters)
        rho = lam / (c * mu)
        
        return {
            'arrival_rate_lambda_per_min': round(lam, 3),
            'service_rate_mu_per_counter_min': round(mu, 3),
            'rolling_avg_service_mins_S_bar': round(s_bar, 2),
            'active_counters_c': c,
            'system_utilization_rho': round(rho, 3),
            'arrivals_in_window': len(self.arrival_timestamps),
            'completions_in_window': len(self.completion_records)
        }

# Global singleton instance
tracker = QueueMetricsTracker()
