"""
Voice and SMS Integration Service (Twilio + Vapi)
Supports natural conversational booking, queue status lookup, rescheduling, and cancellation.
"""

import re
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple, List

from app.database import supabase, in_memory_queue, in_memory_tenants
from app.config import settings
from app.services.ai_engine import parse_user_intent
from app.services.queuing_math import QueuingTheoryEngine
from app.services.ml_predictor import predict_wait_with_variance
from app.workers.velocity_worker import velocity_tracker, recalculate_rolling_velocity


def parse_and_process_sms(
    from_phone: str,
    sms_body: str,
    model=None,
    background_tasks=None
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """
    Processes an inbound SMS from Twilio, handles natural language booking,
    rescheduling, status check, or cancellation, and returns (response_message, ticket_data).
    """
    cleaned_body = sms_body.strip()
    lower_body = cleaned_body.lower()
    
    # -------------------------------------------------------------------------
    # 1. CANCEL ACTION
    # -------------------------------------------------------------------------
    if lower_body.startswith("cancel") or "cancel my ticket" in lower_body or "cancel booking" in lower_body:
        ticket = find_active_ticket_by_phone(from_phone)
        if not ticket:
            return (
                "❌ We couldn't find an active queue ticket linked to this phone number. Text your reason for visit to book a new spot.",
                None
            )
        
        ticket_id = str(ticket.get("id"))
        update_ticket_status_db(ticket_id, "cancelled")
        return (
            f"✅ Ticket #{ticket.get('ticket_number')} has been cancelled. Text us anytime if you need to book again.",
            ticket
        )

    # -------------------------------------------------------------------------
    # 2. RESCHEDULE / DELAY ACTION
    # -------------------------------------------------------------------------
    if (
        "reschedule" in lower_body 
        or "delay" in lower_body 
        or "push back" in lower_body 
        or "later" in lower_body
    ):
        ticket = find_active_ticket_by_phone(from_phone)
        if not ticket:
            return (
                "⚠️ No active ticket found to reschedule. Text your request to book a new queue slot.",
                None
            )
        
        # Extract minutes to delay (default 15 mins)
        delay_match = re.search(r'(\d+)\s*(?:min|mins|minute|minutes)', lower_body)
        delay_mins = int(delay_match.group(1)) if delay_match else 15

        current_wait = float(ticket.get("predicted_wait_mins", 10.0))
        new_wait = round(current_wait + delay_mins, 1)
        new_range = f"{max(1, int(new_wait - 2))} - {int(new_wait + 3)} mins"
        
        ticket_id = str(ticket.get("id"))
        update_ticket_wait_time_db(ticket_id, new_wait, new_range)
        
        return (
            f"🔄 Ticket #{ticket.get('ticket_number')} rescheduled! Added +{delay_mins} mins. New estimated wait: ~{new_wait} mins ({new_range}).",
            ticket
        )

    # -------------------------------------------------------------------------
    # 3. STATUS / WAIT TIME INQUIRY
    # -------------------------------------------------------------------------
    if lower_body in ["status", "wait", "wait time", "check", "where am i", "queue", "info", "?"]:
        ticket = find_active_ticket_by_phone(from_phone)
        if not ticket:
            return (
                "📋 You have no active queue ticket. Simply reply with your reason for visit to join the queue.",
                None
            )
        
        tenant_name = ticket.get("business_id", "our service center").replace("_", " ").title()
        return (
            f"🎟️ Ticket #{ticket.get('ticket_number')} at {tenant_name}:\n"
            f"• Status: {ticket.get('status', 'waiting').upper()}\n"
            f"• Priority: Level {ticket.get('priority_score', 1)}/5\n"
            f"• Estimated Wait: ~{ticket.get('predicted_wait_mins', 5.0)} mins ({ticket.get('display_range', 'Under 5 mins')})\n"
            f"Text 'RESCHEDULE +15m' to delay or 'CANCEL' to drop out.",
            ticket
        )

    # -------------------------------------------------------------------------
    # 4. BOOKING / NEW INTAKE
    # -------------------------------------------------------------------------
    # Determine business tenant context (default: metro_urgent_care)
    business_id = "metro_urgent_care"
    if "dmv" in lower_body or "license" in lower_body or "registration" in lower_body:
        business_id = "city_dmv"
    elif "bank" in lower_body or "loan" in lower_body or "account" in lower_body:
        business_id = "apex_commercial_bank"
    elif "bistro" in lower_body or "table" in lower_body or "restaurant" in lower_body or "reservation" in lower_body:
        business_id = "golden_bistro"
    elif "telecom" in lower_body or "sim" in lower_body or "phone" in lower_body:
        business_id = "telecom_store"

    # Create new ticket via intake logic
    ticket = create_queue_ticket(
        business_id=business_id,
        user_text=cleaned_body,
        phone_number=from_phone,
        model=model,
        background_tasks=background_tasks
    )

    tenant_title = business_id.replace("_", " ").title()
    msg = (
        f"✅ Confirmed! You are in queue at {tenant_title}.\n"
        f"🎟️ Ticket: #{ticket['ticket_number']}\n"
        f"⚡ Priority: {ticket['priority_score']}/5\n"
        f"⏱️ Estimated Wait: ~{ticket['predicted_wait_mins']} mins ({ticket['display_range']})\n\n"
        f"Reply 'STATUS' to check progress, 'RESCHEDULE' to delay, or 'CANCEL' to withdraw."
    )
    return (msg, ticket)


def create_queue_ticket(
    business_id: str,
    user_text: str,
    phone_number: Optional[str] = None,
    model=None,
    background_tasks=None
) -> Dict[str, Any]:
    """
    Core intake helper that extracts AI intent, computes M/M/c baseline,
    applies ML residual, and saves the ticket.
    """
    now = datetime.now()
    velocity_tracker.record_arrival(business_id)

    # Tenant metadata
    tenant_data = in_memory_tenants.get(business_id, {
        "id": str(uuid.uuid4()),
        "business_id": business_id,
        "industry": "General Service",
        "active_counters": settings.DEFAULT_ACTIVE_COUNTERS,
        "base_service_time_mins": settings.DEFAULT_SERVICE_TIME_MIN
    })
    if supabase:
        try:
            res = supabase.table("tenants").select("*").eq("business_id", business_id).single().execute()
            if res.data:
                tenant_data = res.data
        except Exception:
            pass

    active_counters = tenant_data.get("active_counters", settings.DEFAULT_ACTIVE_COUNTERS)
    base_service_time = float(tenant_data.get("base_service_time_mins", settings.DEFAULT_SERVICE_TIME_MIN))

    # AI NLP Triage
    try:
        extracted_features = parse_user_intent(user_text, tenant_data)
    except Exception:
        extracted_features = {
            "service_type": 1,
            "priority_score": 1,
            "is_walk_in": 1,
            "party_size": 1,
            "age_bracket": 1,
            "extracted_by": "fallback"
        }

    priority_score = extracted_features.get("priority_score", 1)

    # Live Queue Count
    live_queue_count = 0
    if supabase:
        try:
            q_res = supabase.table("queue_entries").select("id", count="exact").eq("business_id", business_id).eq("status", "waiting").execute()
            live_queue_count = q_res.count if q_res.count is not None else len(q_res.data or [])
        except Exception:
            live_queue_count = len([e for e in in_memory_queue.values() if e.get("business_id") == business_id and e.get("status") == "waiting"])
    else:
        live_queue_count = len([e for e in in_memory_queue.values() if e.get("business_id") == business_id and e.get("status") == "waiting"])

    # Queuing baseline
    rolling_velocity = velocity_tracker.get_rolling_velocity(business_id, default_val=base_service_time)
    lam = velocity_tracker.get_arrival_rate(business_id)

    try:
        queuing_baseline = QueuingTheoryEngine.calculate_baseline(
            live_queue_count=live_queue_count,
            active_counters=active_counters,
            base_service_time_mins=rolling_velocity,
            priority_score=priority_score,
            arrival_rate=lam
        )
    except Exception:
        queuing_baseline = max(2.0, round((live_queue_count / max(1, active_counters)) * rolling_velocity, 1))

    # ML Prediction
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
        'queuing_theory_baseline': queuing_baseline
    }

    variance_res = predict_wait_with_variance(model, ml_features)
    predicted_exact = variance_res["predicted_exact"]
    display_range = variance_res["display_range"]

    ticket_id = str(uuid.uuid4())
    ticket_num = f"T-{now.strftime('%H%M%S')}-{live_queue_count + 1:02d}"

    insert_payload = {
        "tenant_id": tenant_data.get("id"),
        "business_id": business_id,
        "ticket_number": ticket_num,
        "phone_number": phone_number,
        "priority_score": priority_score,
        "predicted_wait_mins": predicted_exact,
        "display_range": display_range,
        "status": "waiting",
        "created_at": now
    }

    if supabase:
        try:
            insert_res = supabase.table("queue_entries").insert(insert_payload).execute()
            if insert_res.data:
                ticket_id = str(insert_res.data[0].get("id", ticket_id))
        except Exception:
            in_memory_queue[ticket_id] = {"id": ticket_id, **insert_payload}
    else:
        in_memory_queue[ticket_id] = {"id": ticket_id, **insert_payload}

    if background_tasks:
        background_tasks.add_task(recalculate_rolling_velocity, business_id, supabase)

    return {
        "id": ticket_id,
        "ticket_number": ticket_num,
        "business_id": business_id,
        "phone_number": phone_number,
        "priority_score": priority_score,
        "predicted_wait_mins": predicted_exact,
        "display_range": display_range,
        "status": "waiting",
        "created_at": now.isoformat(),
        "extracted_features": extracted_features
    }


def find_active_ticket_by_phone(phone_number: str) -> Optional[Dict[str, Any]]:
    """Finds the most recent waiting/in_progress ticket for a phone number."""
    if not phone_number:
        return None
    
    clean_phone = phone_number.strip().replace(" ", "").replace("-", "")

    if supabase:
        try:
            res = supabase.table("queue_entries") \
                .select("*") \
                .in_("status", ["waiting", "in_progress"]) \
                .order("created_at", desc=True) \
                .execute()
            if res.data:
                for row in res.data:
                    row_phone = str(row.get("phone_number") or "").replace(" ", "").replace("-", "")
                    if row_phone and (clean_phone.endswith(row_phone) or row_phone.endswith(clean_phone)):
                        return row
        except Exception:
            pass

    # In-memory fallback
    for item in sorted(in_memory_queue.values(), key=lambda x: str(x.get("created_at")), reverse=True):
        if item.get("status") in ["waiting", "in_progress"]:
            item_phone = str(item.get("phone_number") or "").replace(" ", "").replace("-", "")
            if item_phone and (clean_phone.endswith(item_phone) or item_phone.endswith(clean_phone)):
                return item

    return None


def update_ticket_status_db(ticket_id: str, status: str):
    """Updates status of a ticket."""
    if supabase:
        try:
            supabase.table("queue_entries").update({"status": status}).eq("id", ticket_id).execute()
        except Exception:
            pass
    if ticket_id in in_memory_queue:
        in_memory_queue[ticket_id]["status"] = status


def update_ticket_wait_time_db(ticket_id: str, new_wait: float, new_range: str):
    """Updates wait time of a ticket upon reschedule."""
    if supabase:
        try:
            supabase.table("queue_entries").update({
                "predicted_wait_mins": new_wait,
                "display_range": new_range
            }).eq("id", ticket_id).execute()
        except Exception:
            pass
    if ticket_id in in_memory_queue:
        in_memory_queue[ticket_id]["predicted_wait_mins"] = new_wait
        in_memory_queue[ticket_id]["display_range"] = new_range


# =============================================================================
# Vapi Tool-Calling Processor
# =============================================================================
def process_vapi_tool_call(
    tool_name: str,
    args: Dict[str, Any],
    model=None,
    background_tasks=None
) -> Dict[str, Any]:
    """
    Executes Vapi Voice Assistant Tool calls and returns assistant-readable results.
    """
    if tool_name == "book_queue_slot":
        business_id = args.get("business_id", "metro_urgent_care")
        user_text = args.get("user_text", "Voice booking call")
        phone_number = args.get("phone_number", None)
        
        ticket = create_queue_ticket(
            business_id=business_id,
            user_text=user_text,
            phone_number=phone_number,
            model=model,
            background_tasks=background_tasks
        )
        return {
            "success": True,
            "ticket_number": ticket["ticket_number"],
            "business_name": business_id.replace("_", " ").title(),
            "priority_score": ticket["priority_score"],
            "predicted_wait_mins": ticket["predicted_wait_mins"],
            "display_range": ticket["display_range"],
            "message": f"I've booked you ticket {ticket['ticket_number']}. Your estimated wait time is {ticket['predicted_wait_mins']} minutes."
        }

    elif tool_name == "check_wait_time":
        ticket_number = args.get("ticket_number")
        phone_number = args.get("phone_number")
        ticket = None
        
        if phone_number:
            ticket = find_active_ticket_by_phone(phone_number)
        
        if not ticket and ticket_number:
            for t in in_memory_queue.values():
                if t.get("ticket_number") == ticket_number:
                    ticket = t
                    break

        if not ticket:
            return {
                "success": False,
                "message": "I could not find an active ticket under that number or phone number."
            }

        return {
            "success": True,
            "ticket_number": ticket.get("ticket_number"),
            "status": ticket.get("status"),
            "predicted_wait_mins": ticket.get("predicted_wait_mins"),
            "display_range": ticket.get("display_range"),
            "message": f"Ticket {ticket.get('ticket_number')} is currently {ticket.get('status')} with an estimated wait of {ticket.get('predicted_wait_mins')} minutes."
        }

    elif tool_name == "reschedule_ticket":
        phone_number = args.get("phone_number")
        delay_mins = int(args.get("delay_mins", 15))
        ticket = find_active_ticket_by_phone(phone_number) if phone_number else None
        
        if not ticket:
            return {
                "success": False,
                "message": "No active ticket found to reschedule for this caller."
            }

        ticket_id = str(ticket.get("id"))
        current_wait = float(ticket.get("predicted_wait_mins", 10.0))
        new_wait = round(current_wait + delay_mins, 1)
        new_range = f"{max(1, int(new_wait - 2))} - {int(new_wait + 3)} mins"
        update_ticket_wait_time_db(ticket_id, new_wait, new_range)

        return {
            "success": True,
            "ticket_number": ticket.get("ticket_number"),
            "new_predicted_wait_mins": new_wait,
            "delay_mins_added": delay_mins,
            "message": f"Ticket {ticket.get('ticket_number')} has been pushed back by {delay_mins} minutes. Your new estimated time is in approximately {new_wait} minutes."
        }

    elif tool_name == "cancel_ticket":
        phone_number = args.get("phone_number")
        ticket = find_active_ticket_by_phone(phone_number) if phone_number else None
        if not ticket:
            return {
                "success": False,
                "message": "I could not find an active ticket to cancel."
            }
        
        ticket_id = str(ticket.get("id"))
        update_ticket_status_db(ticket_id, "cancelled")
        return {
            "success": True,
            "ticket_number": ticket.get("ticket_number"),
            "message": f"Ticket {ticket.get('ticket_number')} has been cancelled."
        }

    return {
        "success": False,
        "message": f"Unknown tool name: {tool_name}"
    }
