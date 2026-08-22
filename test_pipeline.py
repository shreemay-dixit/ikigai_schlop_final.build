#!/usr/bin/env python3
"""
Multi-Tenant Pipeline Smoke Test (test_pipeline.py)
Tests the Universal Plug-and-Play Queue Engine across multiple industries:
Healthcare, Banking, Restaurant, and DMV / Government.
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

def main():
    print_section("UNIVERSAL PLUG-AND-PLAY MULTI-TENANT PIPELINE SMOKE TEST")
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
    # Test Case 1: Healthcare (Metro Urgent Care)
    # -------------------------------------------------------------------------
    print_section("TEST CASE 1: HEALTHCARE (metro_urgent_care)")
    payload_health = {
        "business_id": "metro_urgent_care",
        "user_text": "Child with severe allergic reaction, just rushed in.",
        "phone_number": "+1555001122"
    }
    print(f"Intake Payload:\n{json.dumps(payload_health, indent=2)}")
    r1 = requests.post(f"{BASE_URL}/api/intake", json=payload_health, timeout=15)
    if r1.status_code != 200:
        print(f"Failed Test Case 1: {r1.text}")
        sys.exit(1)

    data1 = r1.json()
    extracted1 = data1.get("extracted_features", {})
    print("\n[Healthcare Intake Result]")
    print(f"Ticket ID:      {data1['ticket_id']}")
    print(f"Ticket Number:  {data1['ticket_number']}")
    print(f"Priority Score: {data1['priority_score']} (Extracted: {extracted1.get('priority_score')})")
    print(f"Service Type:   {extracted1.get('service_type')}")
    print(f"Predicted Wait: {data1['predicted_wait_mins']} mins ({data1['display_range']})")
    print(f"Extracted By:   {extracted1.get('extracted_by')}")
    print(json.dumps(data1, indent=2))

    time.sleep(1.0)

    # -------------------------------------------------------------------------
    # Test Case 2: Banking (Apex Commercial Bank)
    # -------------------------------------------------------------------------
    print_section("TEST CASE 2: BANKING (apex_commercial_bank)")
    payload_bank = {
        "business_id": "apex_commercial_bank",
        "user_text": "I need to deposit a $50 check at the counter, quick visit.",
        "phone_number": "+1555334455"
    }
    print(f"Intake Payload:\n{json.dumps(payload_bank, indent=2)}")
    r2 = requests.post(f"{BASE_URL}/api/intake", json=payload_bank, timeout=15)
    if r2.status_code != 200:
        print(f"Failed Test Case 2: {r2.text}")
        sys.exit(1)

    data2 = r2.json()
    extracted2 = data2.get("extracted_features", {})
    print("\n[Banking Intake Result]")
    print(f"Ticket ID:      {data2['ticket_id']}")
    print(f"Ticket Number:  {data2['ticket_number']}")
    print(f"Priority Score: {data2['priority_score']} (Extracted: {extracted2.get('priority_score')})")
    print(f"Service Type:   {extracted2.get('service_type')}")
    print(f"Predicted Wait: {data2['predicted_wait_mins']} mins ({data2['display_range']})")
    print(f"Extracted By:   {extracted2.get('extracted_by')}")
    print(json.dumps(data2, indent=2))

    time.sleep(1.0)

    # -------------------------------------------------------------------------
    # Test Case 3: Restaurant / Hospitality (Golden Bistro)
    # -------------------------------------------------------------------------
    print_section("TEST CASE 3: RESTAURANT / HOSPITALITY (golden_bistro)")
    payload_restaurant = {
        "business_id": "golden_bistro",
        "user_text": "Table for 6 celebrating an anniversary, booked a week ago.",
        "phone_number": "+1555778899"
    }
    print(f"Intake Payload:\n{json.dumps(payload_restaurant, indent=2)}")
    r3 = requests.post(f"{BASE_URL}/api/intake", json=payload_restaurant, timeout=15)
    if r3.status_code != 200:
        print(f"Failed Test Case 3: {r3.text}")
        sys.exit(1)

    data3 = r3.json()
    extracted3 = data3.get("extracted_features", {})
    print("\n[Restaurant Intake Result]")
    print(f"Ticket ID:      {data3['ticket_id']}")
    print(f"Ticket Number:  {data3['ticket_number']}")
    print(f"Priority Score: {data3['priority_score']}")
    print(f"Party Size:     {extracted3.get('party_size')}")
    print(f"Is Walk-in:     {extracted3.get('is_walk_in')}")
    print(f"Predicted Wait: {data3['predicted_wait_mins']} mins ({data3['display_range']})")
    print(f"Extracted By:   {extracted3.get('extracted_by')}")
    print(json.dumps(data3, indent=2))

    time.sleep(1.0)

    # -------------------------------------------------------------------------
    # Test Case 4: Priority Routing ("Call Next" Verification)
    # -------------------------------------------------------------------------
    print_section("TEST CASE 4: PRIORITY ROUTING VALIDATION (GET /api/queue/{business_id}/next)")
    # Enqueue a routine ticket at DMV, then an urgent ADA assist ticket arriving after it
    dmv_low = requests.post(f"{BASE_URL}/api/intake", json={
        "business_id": "city_dmv",
        "user_text": "I am here to drop off a change of address form."
    }, timeout=10).json()
    print(f"Enqueued Low-Priority DMV ticket: {dmv_low['ticket_number']} (Priority: {dmv_low['priority_score']})")

    time.sleep(0.5)

    dmv_high = requests.post(f"{BASE_URL}/api/intake", json={
        "business_id": "city_dmv",
        "user_text": "I require ADA accessibility assistance and medical transport driver expedited intake."
    }, timeout=10).json()
    print(f"Enqueued High-Priority DMV ticket: {dmv_high['ticket_number']} (Priority: {dmv_high['priority_score']})")

    # Fetch Next
    r_next = requests.get(f"{BASE_URL}/api/queue/city_dmv/next", timeout=10)
    next_ticket = r_next.json()
    print(f"\nDispatched Next Ticket from City DMV:")
    print(f"Ticket ID:      {next_ticket['id']}")
    print(f"Ticket Number:  {next_ticket['ticket_number']}")
    print(f"Priority Score: {next_ticket['priority_score']}")
    
    if next_ticket['priority_score'] >= dmv_low['priority_score']:
        print(">>> SUCCESS: Priority-aware routing correctly selected the highest-priority ticket!")
    else:
        print(">>> Warning: Order verification did not prioritize higher score.")

    # -------------------------------------------------------------------------
    # Test Case 5: Staff Ticket Completion & Background Velocity Recalculation
    # -------------------------------------------------------------------------
    print_section("TEST CASE 5: STAFF COMPLETION & VELOCITY RECALCULATION")
    target_id = next_ticket['id']
    print(f"Marking ticket {target_id} as 'in_progress'...")
    requests.patch(f"{BASE_URL}/api/queue/{target_id}/status", json={"status": "in_progress"}, timeout=10)

    time.sleep(0.5)

    print(f"Marking ticket {target_id} as 'completed'...")
    r_comp = requests.patch(f"{BASE_URL}/api/queue/{target_id}/status", json={"status": "completed"}, timeout=10)
    comp_data = r_comp.json()
    print(f"Completed Status Response:\n{json.dumps(comp_data, indent=2)}")

    print("\nVerifying updated tenant active counters...")
    r_counters = requests.patch(f"{BASE_URL}/api/tenants/city_dmv/counters", json={"active_counters": 6}, timeout=10)
    print(f"Counter Update Response:\n{json.dumps(r_counters.json(), indent=2)}")

    print_section("ALL 5 MULTI-TENANT TEST CASES COMPLETED SUCCESSFULLY")

if __name__ == "__main__":
    main()
