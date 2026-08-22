import uuid
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Dict, Any, List

from fastapi import FastAPI, BackgroundTasks, HTTPException, Request, Path as FastPath
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import get_supabase_client, in_memory_tenants, in_memory_queue
from app.schemas.intake import IntakeRequest, IntakeResponse
from app.schemas.queue import (
    StatusUpdateRequest,
    QueueEntrySchema,
    QueueSnapshotResponse,
    HealthCheckResponse
)
from app.services.ai_engine import parse_user_intent, get_gemini_client, get_groq_client
from app.services.queuing_math import compute_queuing_baseline
from app.services.ml_predictor import ml_predictor
from app.workers.velocity_worker import velocity_tracker, recalculate_rolling_velocity

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cold-start model load
    model_file = settings.resolved_model_path
    loaded = ml_predictor.load_model(model_file)
    app.state.ml_model = ml_predictor.model
    app.state.ml_loaded = loaded
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Endpoint 1: Intake & Triage Pipeline (POST /api/intake)
# -----------------------------------------------------------------------------
@app.post("/api/intake", response_model=IntakeResponse)
async def intake_customer(payload: IntakeRequest, background_tasks: BackgroundTasks) -> IntakeResponse:
    # 1. Record arrival timestamp
    velocity_tracker.record_arrival(payload.business_id)

    # 2. Tenant Lookup (Supabase or In-Memory fallback)
    supabase = get_supabase_client()
    tenant_data = None
    if supabase:
        try:
            res = supabase.table("tenants").select("*").eq("business_id", payload.business_id).single().execute()
            if res.data:
                tenant_data = res.data
        except Exception:
            tenant_data = None

    if not tenant_data:
        tenant_data = in_memory_tenants.get(payload.business_id, {
            "business_id": payload.business_id,
            "industry": "General Services",
            "ai_persona": "customer service intake desk",
            "active_counters": settings.DEFAULT_ACTIVE_COUNTERS,
            "base_service_time": settings.DEFAULT_SERVICE_TIME_MIN
        })

    active_counters = tenant_data.get("active_counters", settings.DEFAULT_ACTIVE_COUNTERS)
    base_service_time = tenant_data.get("base_service_time", settings.DEFAULT_SERVICE_TIME_MIN)
    tenant_persona = tenant_data.get("ai_persona", "general customer service desk")

    # 3. AI Intent Triage (Gemini Structured Outputs with resilient fallback)
    extracted_features = parse_user_intent(payload.user_text, tenant_persona)
    priority_score = extracted_features.get("priority_score", 1)

    # 4. Live Queue State
    live_queue_count = 0
    if supabase:
        try:
            q_res = supabase.table("queue_entries") \
                .select("id", count="exact") \
                .eq("business_id", payload.business_id) \
                .eq("status", "waiting") \
                .execute()
            live_queue_count = q_res.count if q_res.count is not None else len(q_res.data or [])
        except Exception:
            live_queue_count = len([e for e in in_memory_queue.values() if e.get("business_id") == payload.business_id and e.get("status") == "waiting"])
    else:
        live_queue_count = len([e for e in in_memory_queue.values() if e.get("business_id") == payload.business_id and e.get("status") == "waiting"])

    # 5. Deterministic Queuing Theory Baseline (M/M/c Erlang-C + Positional Model)
    rolling_velocity = velocity_tracker.get_rolling_velocity(payload.business_id, default_val=base_service_time)
    lam = velocity_tracker.get_arrival_rate(payload.business_id)

    queuing_metrics = compute_queuing_baseline(
        queue_length_ahead=live_queue_count,
        active_counters=active_counters,
        rolling_velocity_mins=rolling_velocity,
        priority_score=priority_score,
        arrival_rate=lam
    )
    baseline_mins = queuing_metrics["queuing_theory_baseline"]

    # 6. Residual ML Prediction with Tree Variance Confidence Range
    now = datetime.now()
    ml_features = {
        'service_type': extracted_features.get('service_type', 1),
        'priority_score': priority_score,
        'is_walk_in': extracted_features.get('is_walk_in', 1),
        'party_size': extracted_features.get('party_size', 1),
        'age_bracket': extracted_features.get('age_bracket', 1),
        'queue_length_ahead': live_queue_count,
        'active_counters': active_counters,
        'hour_of_day': now.hour,
        'day_of_week': now.weekday(),
        'rolling_velocity_mins': rolling_velocity
    }

    predicted_wait, display_range, rel_err = ml_predictor.predict(ml_features, baseline_mins)

    # 7. DB Persistence
    ticket_id = str(uuid.uuid4())
    ticket_num = f"T-{now.strftime('%H%M%S')}-{live_queue_count + 1:02d}"

    entry_data = {
        "id": ticket_id,
        "business_id": payload.business_id,
        "ticket_number": ticket_num,
        "phone_number": payload.phone_number,
        "priority_score": priority_score,
        "predicted_wait_mins": predicted_wait,
        "display_range": display_range,
        "status": "waiting",
        "served_at": None,
        "completed_at": None,
        "created_at": now.isoformat()
    }

    if supabase:
        try:
            supabase.table("queue_entries").insert(entry_data).execute()
        except Exception:
            in_memory_queue[ticket_id] = {**entry_data, "created_at": now}
    else:
        in_memory_queue[ticket_id] = {**entry_data, "created_at": now}

    # 8. Background Task Offloading
    background_tasks.add_task(recalculate_rolling_velocity, payload.business_id)

    return IntakeResponse(
        ticket_id=ticket_id,
        ticket_number=ticket_num,
        priority_score=priority_score,
        predicted_wait_mins=predicted_wait,
        display_range=display_range,
        relative_error_pct=rel_err,
        queuing_theory_baseline_mins=baseline_mins,
        extracted_features=extracted_features,
        created_at=now
    )

# -----------------------------------------------------------------------------
# Endpoint 2: Ticket Status & Staff Advance (PATCH /api/queue/{ticket_id}/status)
# -----------------------------------------------------------------------------
@app.patch("/api/queue/{ticket_id}/status", response_model=QueueEntrySchema)
async def update_ticket_status(
    ticket_id: str,
    payload: StatusUpdateRequest,
    background_tasks: BackgroundTasks
):
    now = datetime.now()
    supabase = get_supabase_client()
    existing_entry = None
    business_id = "default"

    if supabase:
        try:
            fetch_res = supabase.table("queue_entries").select("*").eq("id", ticket_id).single().execute()
            if fetch_res.data:
                existing_entry = fetch_res.data
                business_id = existing_entry.get("business_id", "default")
        except Exception:
            existing_entry = in_memory_queue.get(ticket_id)
    else:
        existing_entry = in_memory_queue.get(ticket_id)

    if not existing_entry:
        raise HTTPException(status_code=404, detail="Ticket not found")

    update_fields = {"status": payload.status}
    if payload.status == "in_progress" and not existing_entry.get("served_at"):
        update_fields["served_at"] = now.isoformat()
    elif payload.status == "completed":
        update_fields["completed_at"] = now.isoformat()
        if not existing_entry.get("served_at"):
            # If served_at wasn't previously logged, approximate served time
            update_fields["served_at"] = existing_entry.get("created_at")

    if supabase:
        try:
            update_res = supabase.table("queue_entries").update(update_fields).eq("id", ticket_id).execute()
            if update_res.data:
                updated_row = update_res.data[0]
            else:
                updated_row = {**existing_entry, **update_fields}
        except Exception:
            in_memory_queue[ticket_id] = {**existing_entry, **update_fields}
            updated_row = in_memory_queue[ticket_id]
    else:
        in_memory_queue[ticket_id] = {**existing_entry, **update_fields}
        updated_row = in_memory_queue[ticket_id]

    if payload.status == "completed":
        background_tasks.add_task(recalculate_rolling_velocity, business_id)

    return QueueEntrySchema(
        id=updated_row["id"],
        business_id=updated_row["business_id"],
        ticket_number=updated_row["ticket_number"],
        phone_number=updated_row.get("phone_number"),
        priority_score=updated_row["priority_score"],
        predicted_wait_mins=updated_row["predicted_wait_mins"],
        display_range=updated_row["display_range"],
        status=updated_row["status"],
        served_at=datetime.fromisoformat(updated_row["served_at"].replace("Z", "+00:00")) if isinstance(updated_row.get("served_at"), str) else updated_row.get("served_at"),
        completed_at=datetime.fromisoformat(updated_row["completed_at"].replace("Z", "+00:00")) if isinstance(updated_row.get("completed_at"), str) else updated_row.get("completed_at"),
        created_at=datetime.fromisoformat(updated_row["created_at"].replace("Z", "+00:00")) if isinstance(updated_row.get("created_at"), str) else updated_row["created_at"]
    )

# -----------------------------------------------------------------------------
# Endpoint 3: Active Queue Snapshot (GET /api/queue/{business_id})
# -----------------------------------------------------------------------------
@app.get("/api/queue/{business_id}", response_model=QueueSnapshotResponse)
async def get_queue_snapshot(business_id: str):
    supabase = get_supabase_client()
    entries_list = []
    
    if supabase:
        try:
            res = supabase.table("queue_entries") \
                .select("*") \
                .eq("business_id", business_id) \
                .eq("status", "waiting") \
                .order("created_at", desc=False) \
                .execute()
            if res.data:
                entries_list = res.data
        except Exception:
            entries_list = [e for e in in_memory_queue.values() if e.get("business_id") == business_id and e.get("status") == "waiting"]
    else:
        entries_list = [e for e in in_memory_queue.values() if e.get("business_id") == business_id and e.get("status") == "waiting"]

    # Tenant metadata
    tenant = in_memory_tenants.get(business_id, {
        "active_counters": settings.DEFAULT_ACTIVE_COUNTERS,
        "base_service_time": settings.DEFAULT_SERVICE_TIME_MIN
    })
    active_c = tenant.get("active_counters", settings.DEFAULT_ACTIVE_COUNTERS)
    rolling_vel = velocity_tracker.get_rolling_velocity(business_id, default_val=tenant.get("base_service_time", 12.0))
    lam = velocity_tracker.get_arrival_rate(business_id)
    mu = 1.0 / max(0.5, rolling_vel)
    rho = round(lam / (active_c * mu), 3)

    formatted_entries = []
    for row in entries_list:
        formatted_entries.append(QueueEntrySchema(
            id=row["id"],
            business_id=row["business_id"],
            ticket_number=row["ticket_number"],
            phone_number=row.get("phone_number"),
            priority_score=row["priority_score"],
            predicted_wait_mins=row["predicted_wait_mins"],
            display_range=row["display_range"],
            status=row["status"],
            served_at=datetime.fromisoformat(row["served_at"].replace("Z", "+00:00")) if isinstance(row.get("served_at"), str) else row.get("served_at"),
            completed_at=datetime.fromisoformat(row["completed_at"].replace("Z", "+00:00")) if isinstance(row.get("completed_at"), str) else row.get("completed_at"),
            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")) if isinstance(row.get("created_at"), str) else row["created_at"]
        ))

    return QueueSnapshotResponse(
        business_id=business_id,
        active_counters=active_c,
        waiting_count=len(formatted_entries),
        rolling_velocity_mins=round(rolling_vel, 2),
        arrival_rate_lambda_per_min=round(lam, 3),
        system_utilization_rho=rho,
        queue_entries=formatted_entries
    )

# -----------------------------------------------------------------------------
# Endpoint 4: System Health & Fallback Probe (GET /api/health)
# -----------------------------------------------------------------------------
@app.get("/api/health", response_model=HealthCheckResponse)
async def health_check():
    supabase = get_supabase_client()
    db_connected = False
    if supabase:
        try:
            supabase.table("tenants").select("id").limit(1).execute()
            db_connected = True
        except Exception:
            db_connected = False

    gemini_ready = get_gemini_client() is not None
    groq_ready = get_groq_client() is not None

    return HealthCheckResponse(
        status="ok",
        database_connected=db_connected,
        ml_model_loaded=ml_predictor.is_loaded,
        gemini_api_ready=gemini_ready,
        timestamp=datetime.now()
    )
