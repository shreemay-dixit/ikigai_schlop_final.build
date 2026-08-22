import uuid
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import get_supabase, in_memory_tenants, in_memory_queue
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
    # Cold-start single model loading
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
# Helper Functions: Database Operations
# -----------------------------------------------------------------------------
def get_live_queue_count(tenant_id: Optional[str], business_id: str) -> int:
    """
    Step 2: Get Live Queue Count
    Target Table: queue_entries
    Condition: .eq("status", "waiting") and .eq("tenant_id", tenant_id)
    Count Option: .select("id", count="exact")
    """
    client = get_supabase()
    if client:
        try:
            query = client.table("queue_entries").select("id", count="exact").eq("status", "waiting")
            if tenant_id:
                query = query.eq("tenant_id", tenant_id)
            else:
                query = query.eq("business_id", business_id)
            
            res = query.execute()
            if res.count is not None:
                return res.count
            return len(res.data or [])
        except Exception as e:
            # Fallback to local memory count
            pass

    # In-memory count fallback
    matching = [
        e for e in in_memory_queue.values()
        if e.get("status") == "waiting" and (e.get("tenant_id") == tenant_id or e.get("business_id") == business_id)
    ]
    return len(matching)


# -----------------------------------------------------------------------------
# Endpoint 1: Intake & Triage Pipeline (POST /api/intake)
# -----------------------------------------------------------------------------
@app.post("/api/intake", response_model=IntakeResponse)
def intake_customer(payload: IntakeRequest, background_tasks: BackgroundTasks) -> IntakeResponse:
    # 1. Record arrival timestamp
    velocity_tracker.record_arrival(payload.business_id)

    # 2. Tenant Lookup (Supabase or In-Memory fallback)
    client = get_supabase()
    tenant_data = None
    tenant_id = None

    if client:
        try:
            res = client.table("tenants").select("*").eq("business_id", payload.business_id).single().execute()
            if res.data:
                tenant_data = res.data
                tenant_id = tenant_data.get("id")
        except Exception:
            tenant_data = None

    if not tenant_data:
        tenant_data = in_memory_tenants.get(payload.business_id, {
            "id": str(uuid.uuid4()),
            "business_id": payload.business_id,
            "industry": "General Services",
            "ai_persona": "customer service intake desk",
            "active_counters": settings.DEFAULT_ACTIVE_COUNTERS,
            "base_service_time_mins": settings.DEFAULT_SERVICE_TIME_MIN
        })
        tenant_id = tenant_data.get("id")

    active_counters = tenant_data.get("active_counters", settings.DEFAULT_ACTIVE_COUNTERS)
    base_service_time = tenant_data.get("base_service_time_mins", settings.DEFAULT_SERVICE_TIME_MIN)
    tenant_persona = tenant_data.get("ai_persona", "general customer service desk")

    # 3. AI Intent Triage (3-Tier Gemini -> Groq -> Hardcoded)
    extracted_features = parse_user_intent(payload.user_text, tenant_persona)
    priority_score = extracted_features.get("priority_score", 1)

    # 4. Live Queue Count using .select("id", count="exact")
    live_queue_count = get_live_queue_count(tenant_id, payload.business_id)

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

    # 7. Step 3: Insert Ticket Row into Supabase queue_entries
    ticket_id = str(uuid.uuid4())
    ticket_num = f"T-{now.strftime('%H%M%S')}-{live_queue_count + 1:02d}"

    insert_dict = {
        "tenant_id": tenant_id,
        "business_id": payload.business_id,
        "ticket_number": ticket_num,
        "phone_number": payload.phone_number,
        "priority_score": priority_score,
        "predicted_wait_mins": predicted_wait,
        "display_range": display_range
    }

    inserted_record = None
    if client:
        try:
            insert_res = client.table("queue_entries").insert(insert_dict).execute()
            if insert_res.data:
                inserted_record = insert_res.data[0]
                ticket_id = str(inserted_record.get("id", ticket_id))
        except Exception as insert_err:
            # If Supabase insert fails, save in memory fallback so request succeeds
            in_memory_queue[ticket_id] = {
                "id": ticket_id,
                **insert_dict,
                "status": "waiting",
                "created_at": now
            }
    else:
        in_memory_queue[ticket_id] = {
            "id": ticket_id,
            **insert_dict,
            "status": "waiting",
            "created_at": now
        }

    # 8. Background Velocity Recalculation
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
def update_ticket_status(
    ticket_id: str,
    payload: StatusUpdateRequest,
    background_tasks: BackgroundTasks
):
    """
    Step 4: Update Ticket Status Endpoint
    Allows staff to advance a ticket.
    Valid statuses: 'in_progress', 'completed', 'cancelled', 'no_show'.
    """
    valid_statuses = {"waiting", "in_progress", "completed", "cancelled", "no_show"}
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{payload.status}'. Must be one of: {list(valid_statuses)}"
        )

    now = datetime.now()
    client = get_supabase()
    update_data: Dict[str, Any] = {"status": payload.status}

    if payload.status == "in_progress":
        update_data["served_at"] = now.isoformat()
    elif payload.status == "completed":
        update_data["completed_at"] = now.isoformat()

    updated_row = None
    business_id = "default"

    if client:
        try:
            update_res = client.table("queue_entries").update(update_data).eq("id", ticket_id).execute()
            if update_res.data and len(update_res.data) > 0:
                updated_row = update_res.data[0]
                business_id = updated_row.get("business_id", "default")
            else:
                raise HTTPException(status_code=404, detail=f"Ticket '{ticket_id}' not found.")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Supabase update error: {str(e)}")
    else:
        # Check in-memory store
        if ticket_id not in in_memory_queue:
            raise HTTPException(status_code=404, detail=f"Ticket '{ticket_id}' not found.")
        
        in_memory_queue[ticket_id].update(update_data)
        updated_row = in_memory_queue[ticket_id]
        business_id = updated_row.get("business_id", "default")

    if payload.status == "completed":
        background_tasks.add_task(recalculate_rolling_velocity, business_id)

    return QueueEntrySchema(
        id=str(updated_row["id"]),
        business_id=updated_row.get("business_id", business_id),
        ticket_number=updated_row.get("ticket_number", ""),
        phone_number=updated_row.get("phone_number"),
        priority_score=updated_row.get("priority_score", 1),
        predicted_wait_mins=updated_row.get("predicted_wait_mins", 2.0),
        display_range=updated_row.get("display_range", "2 – 3 mins"),
        status=updated_row["status"],
        served_at=datetime.fromisoformat(updated_row["served_at"].replace("Z", "+00:00")) if isinstance(updated_row.get("served_at"), str) else updated_row.get("served_at"),
        completed_at=datetime.fromisoformat(updated_row["completed_at"].replace("Z", "+00:00")) if isinstance(updated_row.get("completed_at"), str) else updated_row.get("completed_at"),
        created_at=datetime.fromisoformat(updated_row["created_at"].replace("Z", "+00:00")) if isinstance(updated_row.get("created_at"), str) else updated_row.get("created_at", now)
    )


# -----------------------------------------------------------------------------
# Endpoint 3: Active Queue Snapshot (GET /api/queue/{business_id})
# -----------------------------------------------------------------------------
@app.get("/api/queue/{business_id}", response_model=QueueSnapshotResponse)
def get_queue_snapshot(business_id: str):
    client = get_supabase()
    entries_list = []

    if client:
        try:
            res = client.table("queue_entries") \
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
        "base_service_time_mins": settings.DEFAULT_SERVICE_TIME_MIN
    })
    active_c = tenant.get("active_counters", settings.DEFAULT_ACTIVE_COUNTERS)
    rolling_vel = velocity_tracker.get_rolling_velocity(business_id, default_val=tenant.get("base_service_time_mins", 12.0))
    lam = velocity_tracker.get_arrival_rate(business_id)
    mu = 1.0 / max(0.5, rolling_vel)
    rho = round(lam / (active_c * mu), 3)

    formatted_entries = []
    for row in entries_list:
        formatted_entries.append(QueueEntrySchema(
            id=str(row["id"]),
            business_id=row.get("business_id", business_id),
            ticket_number=row.get("ticket_number", ""),
            phone_number=row.get("phone_number"),
            priority_score=row.get("priority_score", 1),
            predicted_wait_mins=row.get("predicted_wait_mins", 2.0),
            display_range=row.get("display_range", "2 – 3 mins"),
            status=row.get("status", "waiting"),
            served_at=datetime.fromisoformat(row["served_at"].replace("Z", "+00:00")) if isinstance(row.get("served_at"), str) else row.get("served_at"),
            completed_at=datetime.fromisoformat(row["completed_at"].replace("Z", "+00:00")) if isinstance(row.get("completed_at"), str) else row.get("completed_at"),
            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")) if isinstance(row.get("created_at"), str) else row.get("created_at", datetime.now())
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
def health_check():
    client = get_supabase()
    db_connected = False
    if client:
        try:
            client.table("tenants").select("id").limit(1).execute()
            db_connected = True
        except Exception:
            db_connected = False

    gemini_ready = get_gemini_client() is not None
    groq_ready = get_groq_client() is not None

    return HealthCheckResponse(
        status="ok",
        database_connected=db_connected,
        ml_model_loaded=ml_predictor.is_loaded,
        gemini_api_ready=gemini_ready or groq_ready,
        timestamp=datetime.now()
    )
