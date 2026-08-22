from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException

from schemas.intake import (
    IntakeRequest,
    IntakeResponse,
    PriorityUpdateRequest,
    QueueEntry,
    QueueStateResponse,
    SimpleMessage,
)
from services.ml_service import ml_service
from services.queue_service import queue_service

router = APIRouter(prefix="/intake", tags=["intake"])


def _log_new_entry(token: str):
    
    print(f"[background] new queue entry logged: {token}")


@router.post("", response_model=IntakeResponse)
def create_intake(payload: IntakeRequest, background_tasks: BackgroundTasks):
    
    features = queue_service.extract_features(payload.priority)

    
    estimated_wait = ml_service.predict_wait_time(features)

    
    token = queue_service.generate_token()

    
    entry = QueueEntry(
        token=token,
        patient_name=payload.patient_name,
        age=payload.age,
        reason=payload.reason,
        priority=payload.priority,
        estimated_wait_minutes=estimated_wait,
        created_at=datetime.now(),
    )
    queue_service.add_entry(entry)
    background_tasks.add_task(_log_new_entry, token)

    
    return IntakeResponse(
        token=token,
        position_in_queue=queue_service.position_of(token),
        estimated_wait_minutes=estimated_wait,
        priority=payload.priority,
        created_at=entry.created_at,
    )


@router.get("/queue", response_model=QueueStateResponse)
def get_queue():
    waiting = queue_service.get_queue_state()
    return QueueStateResponse(total_waiting=len(waiting), entries=waiting)


@router.get("/{token}", response_model=QueueEntry)
def get_entry(token: str):
    entry = queue_service.get_entry(token)
    if not entry:
        raise HTTPException(status_code=404, detail="Token not found")
    return entry


@router.post("/{token}/complete", response_model=SimpleMessage)
def complete_entry(token: str):
    if not queue_service.complete_entry(token):
        raise HTTPException(status_code=404, detail="Token not found")
    return SimpleMessage(message=f"{token} marked as completed")


@router.post("/{token}/cancel", response_model=SimpleMessage)
def cancel_entry(token: str):
    if not queue_service.cancel_entry(token):
        raise HTTPException(status_code=404, detail="Token not found")
    return SimpleMessage(message=f"{token} cancelled")


@router.patch("/{token}/priority", response_model=SimpleMessage)
def update_priority(token: str, payload: PriorityUpdateRequest):
    if not queue_service.update_priority(token, payload.priority):
        raise HTTPException(status_code=404, detail="Token not found")
    return SimpleMessage(message=f"{token} priority updated to {payload.priority}")
