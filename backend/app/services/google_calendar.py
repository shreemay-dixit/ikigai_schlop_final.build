"""
Google Calendar Synchronization & Free/Busy Slot Service
Provides real-time calendar availability, event booking, and calendar load metrics.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

# In-memory synchronized calendar event store
in_memory_calendar_events: List[Dict[str, Any]] = [
    {
        "id": "gcal-evt-01",
        "summary": "Dr. Sarah Lin - Scheduled Consultations Block",
        "start_time": (datetime.now().replace(hour=9, minute=0, second=0)).isoformat(),
        "end_time": (datetime.now().replace(hour=11, minute=30, second=0)).isoformat(),
        "provider_name": "Dr. Sarah Lin",
        "status": "busy"
    },
    {
        "id": "gcal-evt-02",
        "summary": "Clinical Staff Operational Sync",
        "start_time": (datetime.now().replace(hour=12, minute=0, second=0)).isoformat(),
        "end_time": (datetime.now().replace(hour=13, minute=0, second=0)).isoformat(),
        "provider_name": "All Providers",
        "status": "busy"
    },
    {
        "id": "gcal-evt-03",
        "summary": "Dr. Marcus Vance - Rehab & Procedure Block",
        "start_time": (datetime.now().replace(hour=14, minute=0, second=0)).isoformat(),
        "end_time": (datetime.now().replace(hour=17, minute=0, second=0)).isoformat(),
        "provider_name": "Dr. Marcus Vance",
        "status": "busy"
    }
]

def get_daily_calendar_events(target_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves all calendar events for the organization on a given date."""
    return in_memory_calendar_events

def get_free_busy_availability(
    provider_name: Optional[str] = None,
    slot_duration_mins: int = 30
) -> List[Dict[str, Any]]:
    """
    Computes available open slots throughout the day based on provider schedule and busy blocks.
    """
    now = datetime.now()
    slots = []
    
    # Generate 30-min slots from 8:00 AM to 6:00 PM
    base_time = now.replace(hour=8, minute=0, second=0, microsecond=0)
    for i in range(20): # 10 hours * 2 slots/hr = 20 slots
        slot_start = base_time + timedelta(minutes=i * slot_duration_mins)
        slot_end = slot_start + timedelta(minutes=slot_duration_mins)
        
        # Check collision with busy events
        is_busy = False
        for evt in in_memory_calendar_events:
            evt_start = datetime.fromisoformat(evt["start_time"])
            evt_end = datetime.fromisoformat(evt["end_time"])
            if not (slot_end <= evt_start or slot_start >= evt_end):
                is_busy = True
                break
        
        slots.append({
            "slot_id": f"slot-{i+1}",
            "start_time": slot_start.isoformat(),
            "end_time": slot_end.isoformat(),
            "display_time": slot_start.strftime("%I:%M %p"),
            "is_available": not is_busy,
            "status": "busy" if is_busy else "open"
        })
        
    return slots

def book_calendar_event(
    patient_name: str,
    patient_phone: str,
    start_time: str,
    duration_mins: int = 30,
    provider_name: str = "Dr. Sarah Lin",
    service_type: str = "Clinical Consultation"
) -> Dict[str, Any]:
    """Books a confirmed slot into Google Calendar."""
    start_dt = datetime.fromisoformat(start_time)
    end_dt = start_dt + timedelta(minutes=duration_mins)
    
    event_id = f"gcal-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    new_event = {
        "id": event_id,
        "summary": f"{service_type} - {patient_name}",
        "patient_name": patient_name,
        "patient_phone": patient_phone,
        "provider_name": provider_name,
        "start_time": start_dt.isoformat(),
        "end_time": end_dt.isoformat(),
        "status": "confirmed",
        "created_at": datetime.now().isoformat()
    }
    
    in_memory_calendar_events.append(new_event)
    return new_event

def calculate_calendar_congestion_factor() -> float:
    """Calculates congestion ratio (0.0 to 1.0) of today's booked blocks."""
    total_slots = 20
    busy_slots = len([e for e in in_memory_calendar_events if e.get("status") in ["busy", "confirmed"]])
    return min(1.0, round(busy_slots / total_slots, 2))
