import uuid
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# App module imports
from app.config import settings
from app.database import supabase, in_memory_tenants, in_memory_queue
from app.services.ai_engine import parse_user_intent, get_gemini_client, get_groq_client
from app.services.queuing_math import QueuingTheoryEngine, compute_queuing_baseline
from app.services.ml_predictor import load_model, predict_wait_with_variance
from app.workers.velocity_worker import velocity_tracker, recalculate_rolling_velocity

# =============================================================================
# Step 2: Set up the FastAPI App & Lifespan
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cold-Start: Load models/wait_predictor_cv.pkl exactly once on startup
    model_path = str(settings.resolved_model_path)
    app.state.ml_model = load_model(model_path)
    app.state.ml_loaded = app.state.ml_model is not None
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

# =============================================================================
# Schemas
# =============================================================================
class IntakeRequest(BaseModel):
    business_id: str = Field(..., description="Unique business/tenant identifier")
    user_text: str = Field(..., description="Natural language description of reason for visit")
    phone_number: Optional[str] = Field(None, description="Optional customer contact phone number")

class IntakeResponse(BaseModel):
    ticket_id: str
    ticket_number: str
    priority_score: int
    predicted_wait_mins: float
    display_range: str
    relative_error_pct: Optional[float] = 10.0
    queuing_theory_baseline_mins: Optional[float] = None
    extracted_features: Optional[Dict[str, Any]] = None
    created_at: datetime

class CounterUpdateRequest(BaseModel):
    active_counters: int = Field(..., ge=1, description="Number of active service counters (minimum 1)")

class TenantResponse(BaseModel):
    business_id: str
    industry: Optional[str] = "General Service"
    ai_persona: Optional[str] = None
    active_counters: int
    base_service_time_mins: float
    created_at: Optional[datetime] = None

class StatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Target status: 'in_progress', 'completed', 'cancelled', 'no_show'")
    counter_id: Optional[str] = Field(None, description="Optional servicing counter identifier")

class QueueEntrySchema(BaseModel):
    id: str
    business_id: str
    ticket_number: str
    phone_number: Optional[str] = None
    priority_score: int
    predicted_wait_mins: float
    display_range: str
    status: str
    served_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

class QueueSnapshotResponse(BaseModel):
    business_id: str
    active_counters: int
    waiting_count: int
    rolling_velocity_mins: float
    arrival_rate_lambda_per_min: float
    system_utilization_rho: float
    queue_entries: List[QueueEntrySchema]

class HealthCheckResponse(BaseModel):
    status: str
    database_connected: bool
    ml_model_loaded: bool
    gemini_api_ready: bool
    timestamp: datetime


# =============================================================================
# Endpoint 1: Intake & Triage Pipeline (POST /api/intake)
# =============================================================================
@app.post("/api/intake", response_model=IntakeResponse)
def intake_customer(payload: IntakeRequest, background_tasks: BackgroundTasks, request: Request) -> IntakeResponse:
    now = datetime.now()
    velocity_tracker.record_arrival(payload.business_id)

    # Phase 1: AI Intent & Tenant Lookup
    tenant_data = None
    tenant_id = None

    if supabase:
        try:
            tenant_res = supabase.table("tenants").select("*").eq("business_id", payload.business_id).single().execute()
            if tenant_res.data:
                tenant_data = tenant_res.data
                tenant_id = tenant_data.get("id")
        except Exception:
            tenant_data = None

    if not tenant_data:
        tenant_data = in_memory_tenants.get(payload.business_id, {
            "id": str(uuid.uuid4()),
            "business_id": payload.business_id,
            "industry": "General Service",
            "ai_persona": "customer service intake desk",
            "active_counters": settings.DEFAULT_ACTIVE_COUNTERS,
            "base_service_time_mins": settings.DEFAULT_SERVICE_TIME_MIN
        })
        tenant_id = tenant_data.get("id")

    active_counters = tenant_data.get("active_counters", settings.DEFAULT_ACTIVE_COUNTERS)
    base_service_time = float(tenant_data.get("base_service_time_mins", settings.DEFAULT_SERVICE_TIME_MIN))
    ai_persona = tenant_data.get("ai_persona", "general customer service desk")

    # 3-Tier AI Intent extraction (Gemini -> Groq -> Hardcoded)
    try:
        extracted_features = parse_user_intent(payload.user_text, ai_persona)
    except Exception:
        extracted_features = {
            "service_type": 1,
            "priority_score": 1,
            "is_walk_in": 1,
            "party_size": 1,
            "age_bracket": 1,
            "extracted_by": "hardcoded_fallback"
        }

    priority_score = extracted_features.get("priority_score", 1)

    # Phase 2: Live State
    live_queue_count = 0
    if supabase:
        try:
            q_query = supabase.table("queue_entries").select("id", count="exact").eq("status", "waiting")
            if tenant_id:
                q_query = q_query.eq("tenant_id", tenant_id)
            else:
                q_query = q_query.eq("business_id", payload.business_id)
            
            q_res = q_query.execute()
            live_queue_count = q_res.count if q_res.count is not None else len(q_res.data or [])
        except Exception:
            live_queue_count = len([e for e in in_memory_queue.values() if e.get("status") == "waiting" and (e.get("tenant_id") == tenant_id or e.get("business_id") == payload.business_id)])
    else:
        live_queue_count = len([e for e in in_memory_queue.values() if e.get("status") == "waiting" and (e.get("tenant_id") == tenant_id or e.get("business_id") == payload.business_id)])

    # Phase 3: Queuing Baseline
    rolling_velocity = velocity_tracker.get_rolling_velocity(payload.business_id, default_val=base_service_time)
    lam = velocity_tracker.get_arrival_rate(payload.business_id)

    try:
        queuing_baseline_mins = QueuingTheoryEngine.calculate_baseline(
            live_queue_count=live_queue_count,
            active_counters=active_counters,
            base_service_time_mins=rolling_velocity,
            priority_score=priority_score,
            arrival_rate=lam
        )
    except Exception:
        queuing_baseline_mins = max(2.0, round((live_queue_count / max(1, active_counters)) * rolling_velocity, 1))

    # Phase 4: ML Inference & Tree Variance Bounds
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
        'rolling_velocity_mins': rolling_velocity,
        'queuing_theory_baseline': queuing_baseline_mins
    }

    model = getattr(request.app.state, "ml_model", None)
    variance_res = predict_wait_with_variance(model, ml_features)
    predicted_exact = variance_res["predicted_exact"]
    display_range = variance_res["display_range"]

    # Phase 5: Database Persistence
    ticket_id = str(uuid.uuid4())
    ticket_num = f"T-{now.strftime('%H%M%S')}-{live_queue_count + 1:02d}"

    insert_payload = {
        "tenant_id": tenant_id,
        "business_id": payload.business_id,
        "ticket_number": ticket_num,
        "phone_number": payload.phone_number,
        "priority_score": priority_score,
        "predicted_wait_mins": predicted_exact,
        "display_range": display_range
    }

    if supabase:
        try:
            insert_res = supabase.table("queue_entries").insert(insert_payload).execute()
            if insert_res.data:
                inserted_row = insert_res.data[0]
                ticket_id = str(inserted_row.get("id", ticket_id))
        except Exception as db_err:
            in_memory_queue[ticket_id] = {
                "id": ticket_id,
                **insert_payload,
                "status": "waiting",
                "created_at": now
            }
    else:
        in_memory_queue[ticket_id] = {
            "id": ticket_id,
            **insert_payload,
            "status": "waiting",
            "created_at": now
        }

    background_tasks.add_task(recalculate_rolling_velocity, payload.business_id, supabase)

    return IntakeResponse(
        ticket_id=ticket_id,
        ticket_number=ticket_num,
        priority_score=priority_score,
        predicted_wait_mins=predicted_exact,
        display_range=display_range,
        queuing_theory_baseline_mins=queuing_baseline_mins,
        extracted_features=extracted_features,
        created_at=now
    )


# =============================================================================
# Task 1: Staff Counter Control Endpoint (PATCH /api/tenants/{business_id}/counters)
# =============================================================================
@app.patch("/api/tenants/{business_id}/counters", response_model=TenantResponse)
def update_tenant_counters(business_id: str, payload: CounterUpdateRequest) -> TenantResponse:
    """
    Dynamically adjusts the number of active service counters for a business.
    """
    updated_record = None
    if supabase:
        try:
            res = supabase.table("tenants") \
                .update({"active_counters": payload.active_counters}) \
                .eq("business_id", business_id) \
                .execute()
            if res.data and len(res.data) > 0:
                updated_record = res.data[0]
        except Exception as e:
            # Fallback to updating in-memory store
            pass

    if not updated_record:
        if business_id not in in_memory_tenants:
            in_memory_tenants[business_id] = {
                "id": str(uuid.uuid4()),
                "business_id": business_id,
                "industry": "General Service",
                "ai_persona": "customer service intake desk",
                "active_counters": payload.active_counters,
                "base_service_time_mins": settings.DEFAULT_SERVICE_TIME_MIN,
                "created_at": datetime.now()
            }
        else:
            in_memory_tenants[business_id]["active_counters"] = payload.active_counters
        updated_record = in_memory_tenants[business_id]

    return TenantResponse(
        business_id=updated_record.get("business_id", business_id),
        industry=updated_record.get("industry", "General Service"),
        ai_persona=updated_record.get("ai_persona"),
        active_counters=updated_record.get("active_counters", payload.active_counters),
        base_service_time_mins=float(updated_record.get("base_service_time_mins", settings.DEFAULT_SERVICE_TIME_MIN)),
        created_at=datetime.fromisoformat(str(updated_record["created_at"]).replace("Z", "+00:00")) if updated_record.get("created_at") and isinstance(updated_record.get("created_at"), str) else updated_record.get("created_at", datetime.now())
    )


# =============================================================================
# Task 2: Ticket Status Update & Velocity Worker (PATCH /api/queue/{ticket_id}/status)
# =============================================================================
@app.patch("/api/queue/{ticket_id}/status", response_model=QueueEntrySchema)
def update_ticket_status(
    ticket_id: str,
    payload: StatusUpdateRequest,
    background_tasks: BackgroundTasks
):
    valid_statuses = {"waiting", "in_progress", "completed", "cancelled", "no_show"}
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status '{payload.status}'. Must be one of: {list(valid_statuses)}")

    now = datetime.now()
    update_data: Dict[str, Any] = {"status": payload.status}

    if payload.status == "in_progress":
        update_data["served_at"] = now.isoformat()
    elif payload.status == "completed":
        update_data["completed_at"] = now.isoformat()

    updated_row = None
    business_id = "default"

    if supabase:
        try:
            update_res = supabase.table("queue_entries").update(update_data).eq("id", ticket_id).execute()
            if update_res.data and len(update_res.data) > 0:
                updated_row = update_res.data[0]
                business_id = updated_row.get("business_id", "default")
            else:
                # Check fallback
                if ticket_id in in_memory_queue:
                    in_memory_queue[ticket_id].update(update_data)
                    updated_row = in_memory_queue[ticket_id]
                    business_id = updated_row.get("business_id", "default")
                else:
                    raise HTTPException(status_code=404, detail=f"Ticket '{ticket_id}' not found.")
        except HTTPException:
            raise
        except Exception as e:
            if ticket_id in in_memory_queue:
                in_memory_queue[ticket_id].update(update_data)
                updated_row = in_memory_queue[ticket_id]
                business_id = updated_row.get("business_id", "default")
            else:
                raise HTTPException(status_code=500, detail=f"Supabase update error: {str(e)}")
    else:
        if ticket_id not in in_memory_queue:
            raise HTTPException(status_code=404, detail=f"Ticket '{ticket_id}' not found.")
        in_memory_queue[ticket_id].update(update_data)
        updated_row = in_memory_queue[ticket_id]
        business_id = updated_row.get("business_id", "default")

    if payload.status == "completed":
        background_tasks.add_task(recalculate_rolling_velocity, business_id, supabase)

    return QueueEntrySchema(
        id=str(updated_row["id"]),
        business_id=updated_row.get("business_id", business_id),
        ticket_number=updated_row.get("ticket_number", ""),
        phone_number=updated_row.get("phone_number"),
        priority_score=updated_row.get("priority_score", 1),
        predicted_wait_mins=updated_row.get("predicted_wait_mins", 2.0),
        display_range=updated_row.get("display_range", "Under 5 mins"),
        status=updated_row["status"],
        served_at=datetime.fromisoformat(updated_row["served_at"].replace("Z", "+00:00")) if isinstance(updated_row.get("served_at"), str) else updated_row.get("served_at"),
        completed_at=datetime.fromisoformat(updated_row["completed_at"].replace("Z", "+00:00")) if isinstance(updated_row.get("completed_at"), str) else updated_row.get("completed_at"),
        created_at=datetime.fromisoformat(updated_row["created_at"].replace("Z", "+00:00")) if isinstance(updated_row.get("created_at"), str) else updated_row.get("created_at", now)
    )


# =============================================================================
# Task 3: The "Call Next" Priority Sorting Endpoint (GET /api/queue/{business_id}/next)
# =============================================================================
@app.get("/api/queue/{business_id}/next", response_model=QueueEntrySchema)
def get_next_ticket(business_id: str):
    """
    Retrieves the next optimal ticket to serve:
    Sorted primarily by priority_score DESC, then by created_at ASC.
    """
    next_ticket = None

    if supabase:
        try:
            # Query Supabase: status = 'waiting' AND (tenant_id = business_id OR business_id = business_id)
            res = supabase.table("queue_entries") \
                .select("*") \
                .or_(f"tenant_id.eq.{business_id},business_id.eq.{business_id}") \
                .eq("status", "waiting") \
                .order("priority_score", desc=True) \
                .order("created_at", desc=False) \
                .limit(1) \
                .execute()

            if res.data and len(res.data) > 0:
                next_ticket = res.data[0]
        except Exception:
            next_ticket = None

    # In-memory fallback sorting if DB was offline or empty
    if not next_ticket:
        waiting_entries = [
            e for e in in_memory_queue.values()
            if (e.get("business_id") == business_id or e.get("tenant_id") == business_id) and e.get("status") == "waiting"
        ]
        if waiting_entries:
            # Sort by priority_score DESC, then created_at ASC
            waiting_entries.sort(
                key=lambda x: (
                    -int(x.get("priority_score", 1)),
                    x.get("created_at").timestamp() if isinstance(x.get("created_at"), datetime) else 0.0
                )
            )
            next_ticket = waiting_entries[0]

    if not next_ticket:
        raise HTTPException(status_code=404, detail=f"Queue is empty for business '{business_id}'.")

    now = datetime.now()
    return QueueEntrySchema(
        id=str(next_ticket["id"]),
        business_id=next_ticket.get("business_id", business_id),
        ticket_number=next_ticket.get("ticket_number", ""),
        phone_number=next_ticket.get("phone_number"),
        priority_score=next_ticket.get("priority_score", 1),
        predicted_wait_mins=next_ticket.get("predicted_wait_mins", 2.0),
        display_range=next_ticket.get("display_range", "Under 5 mins"),
        status=next_ticket.get("status", "waiting"),
        served_at=datetime.fromisoformat(next_ticket["served_at"].replace("Z", "+00:00")) if isinstance(next_ticket.get("served_at"), str) else next_ticket.get("served_at"),
        completed_at=datetime.fromisoformat(next_ticket["completed_at"].replace("Z", "+00:00")) if isinstance(next_ticket.get("completed_at"), str) else next_ticket.get("completed_at"),
        created_at=datetime.fromisoformat(next_ticket["created_at"].replace("Z", "+00:00")) if isinstance(next_ticket.get("created_at"), str) else next_ticket.get("created_at", now)
    )


# =============================================================================
# Endpoint: Active Queue Snapshot (GET /api/queue/{business_id})
# =============================================================================
@app.get("/api/queue/{business_id}", response_model=QueueSnapshotResponse)
def get_queue_snapshot(business_id: str):
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
            display_range=row.get("display_range", "Under 5 mins"),
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


# =============================================================================
# Endpoint: System Health & Fallback Probe (GET /api/health)
# =============================================================================
@app.get("/api/health", response_model=HealthCheckResponse)
def health_check(request: Request):
    db_connected = False
    if supabase:
        try:
            supabase.table("tenants").select("id").limit(1).execute()
            db_connected = True
        except Exception:
            db_connected = False

    gemini_ready = get_gemini_client() is not None
    groq_ready = get_groq_client() is not None
    ml_loaded = getattr(request.app.state, "ml_model", None) is not None

    return HealthCheckResponse(
        status="ok",
        database_connected=db_connected,
        ml_model_loaded=ml_loaded,
        gemini_api_ready=gemini_ready or groq_ready,
        timestamp=datetime.now()
    )
