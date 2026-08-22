from datetime import datetime

from core.config import settings
from schemas.intake import PriorityLevel, QueueEntry

PRIORITY_SCORES = {
    PriorityLevel.normal: 1.0,
    PriorityLevel.urgent: 1.5,
    PriorityLevel.emergency: 3.0,
}


class QueueService:
    """
    In-memory queue store (dict, cleared on restart). This is the only
    thing that changes when Supabase gets wired in — the method names
    (add_entry, get_entry, complete_entry, ...) stay the same, so
    routes/intake.py won't need to change.
    """

    def __init__(self):
        self._queue: dict[str, QueueEntry] = {}
        self._counter = 0

    def generate_token(self) -> str:
        self._counter += 1
        today = datetime.now().strftime("%Y%m%d")
        return f"Q-{today}-{self._counter:04d}"

    def get_queue_state(self) -> list[QueueEntry]:
        return [e for e in self._queue.values() if e.status == "waiting"]

    def extract_features(self, priority: PriorityLevel) -> dict:
        waiting = self.get_queue_state()
        return {
            "queue_length": len(waiting),
            "priority_score": PRIORITY_SCORES[priority],
            "hour_of_day": datetime.now().hour,
            "avg_service_time": settings.DEFAULT_SERVICE_TIME_MIN,
        }

    def add_entry(self, entry: QueueEntry):
        self._queue[entry.token] = entry

    def get_entry(self, token: str) -> QueueEntry | None:
        return self._queue.get(token)

    def complete_entry(self, token: str) -> bool:
        entry = self._queue.get(token)
        if not entry:
            return False
        entry.status = "completed"
        return True

    def cancel_entry(self, token: str) -> bool:
        entry = self._queue.get(token)
        if not entry:
            return False
        entry.status = "cancelled"
        return True

    def update_priority(self, token: str, priority: PriorityLevel) -> bool:
        entry = self._queue.get(token)
        if not entry:
            return False
        entry.priority = priority
        return True

    def position_of(self, token: str) -> int:
        waiting = self.get_queue_state()
        for idx, e in enumerate(waiting, start=1):
            if e.token == token:
                return idx
        return -1


queue_service = QueueService()
