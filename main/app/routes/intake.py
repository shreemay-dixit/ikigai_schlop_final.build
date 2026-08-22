import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, status
from main.app.db.supabase import (
    count_waiting_entries,
    create_queue_entry,
    generate_queue_token,
    get_business_config,
    resolve_business_id,
)
from main.app.schemas.intake import QueueIntakeRequestV1, QueueIntakeResponseV1
from main.app.services.predictor import WaitPredictorService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/intake",
    response_model=QueueIntakeResponseV1,
    status_code=status.HTTP_200_OK,
    summary="Register customer intake and allocate queue token",
)
async def process_queue_intake(
    payload: QueueIntakeRequestV1, request: Request
) -> QueueIntakeResponseV1:
    # 1. Resolve Predictor Service
    predictor: WaitPredictorService = getattr(
        request.app.state, "predictor_service", None
    )
    if not predictor or not predictor.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Predictor service is not initialized or ready.",
        )

    # 2. Resolve Configured Business UUID (read-only, never inserts into businesses)
    try:
        business_id = resolve_business_id()
    except Exception as exc:
        logger.error(f"Failed to resolve business: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database business configuration unavailable: {str(exc)}",
        )

    # 3. Query Business Config
    config = get_business_config(business_id)
    if config:
        active_counters = int(config.get("active_counters", 3))
        average_service_time = float(config.get("average_service_time", 15.0))
    else:
        active_counters = 3
        average_service_time = 15.0

    # 4. Count waiting entries (Queue Length Ahead)
    try:
        queue_length_ahead = count_waiting_entries(business_id)
    except Exception as exc:
        logger.error(f"Failed to count waiting entries: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database queue count unavailable: {str(exc)}",
        )

    # 5. Derive environmental & temporal features from backend server time
    now_utc = datetime.now(timezone.utc)
    now_local = datetime.now()
    hour_of_day = now_local.hour
    day_of_week = now_local.weekday()  # Monday=0 through Sunday=6
    rolling_velocity_mins = average_service_time

    # 6. Construct EXACT 10-feature dictionary
    feature_dict = {
        "service_type": payload.service_type,
        "priority_score": payload.priority_score,
        "is_walk_in": 1 if payload.is_walk_in else 0,
        "party_size": payload.party_size,
        "age_bracket": payload.age_bracket,
        "queue_length_ahead": queue_length_ahead,
        "active_counters": active_counters,
        "hour_of_day": hour_of_day,
        "day_of_week": day_of_week,
        "rolling_velocity_mins": rolling_velocity_mins,
    }

    final_priority_score = payload.priority_score

    # 7. Run ML Model Prediction with graceful inference-time fallback
    try:
        features_df = predictor.construct_features_df_from_dict(feature_dict)
        predicted_wait_mins = predictor.predict_from_df(features_df)
    except Exception as exc:
        logger.warning(
            f"ML inference failure at runtime, applying fallback calculation: {exc}"
        )
        predicted_wait_mins = float(max(0.0, round(queue_length_ahead * 15.0, 2)))
        final_priority_score = 1

    # 8. Generate Concurrency-Safe Queue Token
    token_prefix = "A"
    token = generate_queue_token(
        business_id=business_id,
        service_type=payload.service_type,
        prefix=token_prefix,
    )

    # 9. Insert Queue Entry into Supabase (queue_entries only)
    entry_payload = {
        "business_id": business_id,
        "token": token,
        "user_name": payload.user_name,
        "service_type": payload.service_type,
        "priority_score": final_priority_score,
        "is_walk_in": payload.is_walk_in,
        "party_size": payload.party_size,
        "age_bracket": payload.age_bracket,
        "queue_length_ahead": queue_length_ahead,
        "active_counters": active_counters,
        "rolling_velocity_mins": rolling_velocity_mins,
        "predicted_wait_mins": predicted_wait_mins,
        "status": "waiting",
        "created_at": now_utc.isoformat(),
    }

    try:
        created_record = create_queue_entry(entry_payload)
    except Exception as exc:
        logger.error(f"Failed to insert queue entry: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record queue entry in database: {str(exc)}",
        )

    # 10. Return Structured Queue Intake Response
    return QueueIntakeResponseV1(
        queue_entry_id=str(created_record.get("id")),
        token=token,
        predicted_wait_mins=predicted_wait_mins,
        priority_score=final_priority_score,
        queue_length_ahead=queue_length_ahead,
        status="waiting",
        created_at=str(created_record.get("created_at", now_utc.isoformat())),
    )
