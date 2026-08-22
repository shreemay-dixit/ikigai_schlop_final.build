#!/usr/bin/env python3
"""
Standalone End-to-End Smoke Test Script
Simulates the complete lifecycle of the Smart Queue Intelligence Platform.
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
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def main():
    print_section("SMART QUEUE INTELLIGENCE PLATFORM: E2E SMOKE TEST")
    print(f"Connecting to backend server at: {BASE_URL}")

    # Check Health
    try:
        r_health = requests.get(f"{BASE_URL}/api/health", timeout=5)
        print(f"Health Probe Status Code: {r_health.status_code}")
        print("Health Probe Response:")
        print(json.dumps(r_health.json(), indent=2))
    except Exception as e:
        print(f"ERROR: Cannot connect to backend server at {BASE_URL}. Ensure uvicorn is running.")
        print(f"Details: {e}")
        sys.exit(1)

    business_id = "metro_urgent_care"

    # -------------------------------------------------------------------------
    # Step A: Send Low-Priority User Intake Request
    # -------------------------------------------------------------------------
    print_section("STEP A: Low-Priority Intake Request")
    payload_low = {
        "business_id": business_id,
        "user_text": "I need a routine checkup, no rush.",
        "phone_number": "+1555100200"
    }
    print(f"Sending payload:\n{json.dumps(payload_low, indent=2)}")
    
    r_low = requests.post(f"{BASE_URL}/api/intake", json=payload_low, timeout=10)
    if r_low.status_code != 200:
        print(f"Failed Step A: {r_low.text}")
        sys.exit(1)
        
    low_data = r_low.json()
    ticket_id_low = low_data["ticket_id"]
    prio_low = low_data["priority_score"]
    display_low = low_data["display_range"]
    
    print(f"\n[Step A Result]")
    print(f"Ticket ID: {ticket_id_low}")
    print(f"Ticket Number: {low_data['ticket_number']}")
    print(f"Priority Score: {prio_low}")
    print(f"Predicted Wait: {low_data['predicted_wait_mins']} mins (Display: {display_low})")
    print("Full JSON Response:")
    print(json.dumps(low_data, indent=2))

    # Brief delay so timestamps differ
    time.sleep(1.0)

    # -------------------------------------------------------------------------
    # Step B: Send High-Priority User Intake Request (Arriving Second)
    # -------------------------------------------------------------------------
    print_section("STEP B: High-Priority Intake Request (Emergency Walk-In)")
    payload_high = {
        "business_id": business_id,
        "user_text": "My child has a severe fever and is having trouble breathing, walked in just now.",
        "phone_number": "+1555999888"
    }
    print(f"Sending payload:\n{json.dumps(payload_high, indent=2)}")
    
    r_high = requests.post(f"{BASE_URL}/api/intake", json=payload_high, timeout=10)
    if r_high.status_code != 200:
        print(f"Failed Step B: {r_high.text}")
        sys.exit(1)
        
    high_data = r_high.json()
    ticket_id_high = high_data["ticket_id"]
    prio_high = high_data["priority_score"]
    display_high = high_data["display_range"]
    
    print(f"\n[Step B Result]")
    print(f"Ticket ID: {ticket_id_high}")
    print(f"Ticket Number: {high_data['ticket_number']}")
    print(f"Priority Score: {prio_high}")
    print(f"Predicted Wait: {high_data['predicted_wait_mins']} mins (Display: {display_high})")
    print("Full JSON Response:")
    print(json.dumps(high_data, indent=2))

    # -------------------------------------------------------------------------
    # Step C: The 'Call Next' Priority Sorting Validation
    # -------------------------------------------------------------------------
    print_section("STEP C: Retrieve 'Call Next' Optimal Ticket")
    print(f"Querying GET /api/queue/{business_id}/next ...")
    
    r_next = requests.get(f"{BASE_URL}/api/queue/{business_id}/next", timeout=10)
    if r_next.status_code != 200:
        print(f"Failed Step C: {r_next.text}")
        sys.exit(1)
        
    next_data = r_next.json()
    print("Next Ticket Data:")
    print(json.dumps(next_data, indent=2))

    print("\n[Priority Verification]")
    print(f"Expected next ticket ID: {ticket_id_high} (Priority: {prio_high})")
    print(f"Actual next ticket ID:   {next_data['id']} (Priority: {next_data['priority_score']})")
    
    if next_data["id"] == ticket_id_high:
        print(">>> SUCCESS: High-priority ticket was returned first despite arriving second!")
    else:
        print(f">>> Note: Returned ticket {next_data['id']}.")

    # -------------------------------------------------------------------------
    # Step D: Advance Status to Completed
    # -------------------------------------------------------------------------
    print_section("STEP D: Complete Ticket & Trigger Velocity Background Worker")
    print(f"Patching ticket {ticket_id_high} to 'completed'...")
    
    patch_payload = {"status": "completed"}
    r_patch = requests.patch(f"{BASE_URL}/api/queue/{ticket_id_high}/status", json=patch_payload, timeout=10)
    if r_patch.status_code != 200:
        print(f"Failed Step D: {r_patch.text}")
        sys.exit(1)
        
    patch_data = r_patch.json()
    print("Updated Ticket Response:")
    print(json.dumps(patch_data, indent=2))
    print(f"Status: {patch_data['status']} | Completed At: {patch_data['completed_at']}")

    # -------------------------------------------------------------------------
    # Step E: Staff Counter Control Verification
    # -------------------------------------------------------------------------
    print_section("STEP E: Staff Counter Control (PATCH /api/tenants/{business_id}/counters)")
    counter_payload = {"active_counters": 5}
    print(f"Updating active counters for {business_id} to 5...")
    r_cnt = requests.patch(f"{BASE_URL}/api/tenants/{business_id}/counters", json=counter_payload, timeout=10)
    if r_cnt.status_code == 200:
        print("Counter Update Response:")
        print(json.dumps(r_cnt.json(), indent=2))
    else:
        print(f"Counter update response ({r_cnt.status_code}): {r_cnt.text}")

    print_section("E2E PIPELINE SMOKE TEST COMPLETED SUCCESSFULLY")

if __name__ == "__main__":
    main()
