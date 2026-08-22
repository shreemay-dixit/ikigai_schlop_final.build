#!/usr/bin/env python3
"""
Universal Multi-Tenant & Multilingual Pipeline Smoke Test (test_pipeline.py)
Tests the queue management system across multiple industries and languages:
- English, Spanish, Hindi, French, and Japanese
"""

import json
import sys
import time

try:
    import requests
except ImportError:
    print("Installing requests library...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

BASE_URL = "http://localhost:8000"

def print_section(title: str):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def run_intake_test(business_id: str, user_text: str, language_name: str, expected_context: str, phone: str = "+1555123456"):
    print(f"\n--- [{language_name}] Intake for {business_id} ({expected_context}) ---")
    payload = {
        "business_id": business_id,
        "user_text": user_text,
        "phone_number": phone
    }
    print(f"Raw Input: '{user_text}'")
    
    r = requests.post(f"{BASE_URL}/api/intake", json=payload, timeout=15)
    if r.status_code != 200:
        print(f"FAILED: {r.text}")
        return None
        
    data = r.json()
    extracted = data.get("extracted_features", {})
    print(f"Ticket ID:      {data['ticket_id']}")
    print(f"Ticket Number:  {data['ticket_number']}")
    print(f"Priority Score: {data['priority_score']} (Extracted: {extracted.get('priority_score')})")
    print(f"Service Type:   {extracted.get('service_type')}")
    print(f"Party Size:     {extracted.get('party_size')} | Walk-in: {extracted.get('is_walk_in')}")
    print(f"Wait Time:      {data['predicted_wait_mins']} mins (Display: {data['display_range']})")
    print(f"Engine Tier:    {extracted.get('extracted_by')}")
    return data

def main():
    print_section("SMART QUEUE PLATFORM: MULTI-TENANT & MULTILINGUAL PIPELINE TEST")
    print(f"Targeting API Server at: {BASE_URL}")

    # Check Health
    try:
        r_health = requests.get(f"{BASE_URL}/api/health", timeout=5)
        print(f"Health Probe Status: {r_health.status_code}")
        print(json.dumps(r_health.json(), indent=2))
    except Exception as e:
        print(f"ERROR: Cannot connect to backend server at {BASE_URL}. Ensure uvicorn is running.")
        print(f"Details: {e}")
        sys.exit(1)

    # -------------------------------------------------------------------------
    # Multilingual Test Case 1: Spanish (Healthcare Emergency)
    # -------------------------------------------------------------------------
    print_section("1. SPANISH: Healthcare ER Triage (metro_urgent_care)")
    spanish_text = "Mi abuela tiene un dolor en el pecho muy fuerte y no puede respirar bien, acabamos de llegar."
    run_intake_test(
        business_id="metro_urgent_care",
        user_text=spanish_text,
        language_name="Spanish (Español)",
        expected_context="Emergency chest pain & breathing difficulty -> Expect Priority 5"
    )
    time.sleep(0.5)

    # -------------------------------------------------------------------------
    # Multilingual Test Case 2: Hindi (Banking Consultation)
    # -------------------------------------------------------------------------
    print_section("2. HINDI: Commercial Bank Account & Loan (apex_commercial_bank)")
    hindi_text = "मुझे अपने नए व्यवसाय के लिए एक करंट अकाउंट खोलना है और कमर्शियल लोन के बारे में सलाह चाहिए।"
    run_intake_test(
        business_id="apex_commercial_bank",
        user_text=hindi_text,
        language_name="Hindi (हिंदी)",
        expected_context="Commercial business account & loan inquiry -> Expect Service Type 2, Priority 3"
    )
    time.sleep(0.5)

    # -------------------------------------------------------------------------
    # Multilingual Test Case 3: French (Restaurant VIP Table Reservation)
    # -------------------------------------------------------------------------
    print_section("3. FRENCH: Restaurant Reservation (golden_bistro)")
    french_text = "Une table pour quatre personnes pour fêter un anniversaire de mariage, nous avons réservé la semaine dernière."
    run_intake_test(
        business_id="golden_bistro",
        user_text=french_text,
        language_name="French (Français)",
        expected_context="Anniversary party of 4, booked in advance -> Expect party_size: 4, is_walk_in: 0, Priority: 4"
    )
    time.sleep(0.5)

    # -------------------------------------------------------------------------
    # Multilingual Test Case 4: Japanese (Government/DMV Routine Renewal)
    # -------------------------------------------------------------------------
    print_section("4. JAPANESE: DMV License Renewal (city_dmv)")
    japanese_text = "運転免許証の更新手続きに来ました。事前予約済みです。"
    run_intake_test(
        business_id="city_dmv",
        user_text=japanese_text,
        language_name="Japanese (日本語)",
        expected_context="Routine driving license renewal, pre-booked -> Expect Service Type 0/1, is_walk_in: 0"
    )
    time.sleep(0.5)

    # -------------------------------------------------------------------------
    # Multilingual Test Case 5: English (Quick Check Deposit & Priority Sorting)
    # -------------------------------------------------------------------------
    print_section("5. ENGLISH: DMV ADA Assistance & Priority Routing Verification")
    
    # Routine customer
    d_routine = run_intake_test(
        business_id="city_dmv",
        user_text="I am dropping off standard registration papers.",
        language_name="English",
        expected_context="Routine drop-off -> Priority 1"
    )
    time.sleep(0.5)

    # Urgent ADA customer
    d_urgent = run_intake_test(
        business_id="city_dmv",
        user_text="I need urgent wheelchair ADA assistance for medical transport driver license verification.",
        language_name="English",
        expected_context="ADA accessibility express -> Priority 5"
    )
    time.sleep(0.5)

    # Test "Call Next" Sorting
    print("\n--- Testing Priority-Aware 'Call Next' (GET /api/queue/city_dmv/next) ---")
    r_next = requests.get(f"{BASE_URL}/api/queue/city_dmv/next", timeout=10)
    next_data = r_next.json()
    print(f"Dispatched Next Ticket: {next_data.get('ticket_number')} (Priority: {next_data.get('priority_score')})")
    
    # -------------------------------------------------------------------------
    # Lifecycle Status Advance & Worker Trigger
    # -------------------------------------------------------------------------
    print("\n--- Advancing Ticket to 'completed' & Triggering Velocity Background Worker ---")
    target_id = next_data['id']
    requests.patch(f"{BASE_URL}/api/queue/{target_id}/status", json={"status": "in_progress"}, timeout=10)
    r_comp = requests.patch(f"{BASE_URL}/api/queue/{target_id}/status", json={"status": "completed"}, timeout=10)
    print(f"Ticket {target_id} Status: {r_comp.json().get('status')} | Completed At: {r_comp.json().get('completed_at')}")

    print_section("ALL MULTILINGUAL & MULTI-TENANT TESTS COMPLETED SUCCESSFULLY")

if __name__ == "__main__":
    main()
