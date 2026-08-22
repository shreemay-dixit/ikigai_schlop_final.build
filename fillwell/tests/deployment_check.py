import urllib.request
import urllib.error
import json
import time
import threading

BASE_URL = "http://localhost:3000"

def color(text, code):
    return f"\033[{code}m{text}\033[0m"

def print_pass(msg):
    print(color(f"✅ PASS: {msg}", "32"))

def print_fail(msg):
    print(color(f"❌ FAIL: {msg}", "31"))

def make_request(method, path, payload=None):
    url = f"{BASE_URL}{path}"
    headers = {'Content-Type': 'application/json'} if payload else {}
    data = json.dumps(payload).encode('utf-8') if payload else None
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode('utf-8')
            return response.status, json.loads(res_body) if res_body else None
    except urllib.error.HTTPError as e:
        res_body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(res_body)
        except:
            return e.code, {"error": res_body}
    except Exception as e:
        return 0, {"error": str(e)}

def test_api_connectivity():
    print("\n--- Testing API Connectivity ---")
    endpoints = ["/api/appointments", "/api/waitlist", "/api/recovery/override"]
    passed = True
    for ep in endpoints:
        status, _ = make_request("GET", ep)
        if status == 200:
            print_pass(f"GET {ep} returned 200 OK")
        else:
            print_fail(f"GET {ep} returned {status}")
            passed = False
    return passed

def test_triage_and_waitlist():
    print("\n--- Testing Patient Triage & Waitlist ---")
    
    # 1. Simulate Triage
    payload = {
        "transcript": "Patient: John Doe. Phone: +15551234567. Complaint: Severe chest pain.",
        "channel": "patient_gateway"
    }
    status, res = make_request("POST", "/api/gemini/triage", payload)
    
    if status == 200 and res.get("success"):
        print_pass("Gemini Triage API responded successfully")
        triage_data = res.get("data", {})
    else:
        print_fail(f"Gemini Triage API failed: {res.get('error')}")
        return False
        
    # 2. Add to Waitlist
    wl_payload = {
        "patient_name": "Integration Test Patient",
        "patient_phone": "+15550000000",
        "urgency_tier": triage_data.get("urgency_tier", "urgent"),
        "priority_score": triage_data.get("priority_score", 5),
        "preferred_time_windows": ["mornings"],
        "preferred_days": ["monday"]
    }
    status, res = make_request("POST", "/api/waitlist", wl_payload)
    
    if status == 201 and res.get("success"):
        print_pass("Waitlist POST succeeded")
        return res["data"]["id"]
    else:
        print_fail(f"Waitlist POST failed: {res}")
        return False

def test_cancellation_and_recovery():
    print("\n--- Testing Cancellation & Recovery Wave ---")
    
    # 1. Reset sandbox to get clean appointments
    make_request("POST", "/api/sandbox", {"action": "reset"})
    make_request("POST", "/api/sandbox", {"action": "seed"})
    
    # 2. Get appointments
    status, res = make_request("GET", "/api/appointments")
    if status != 200 or not res.get("data"):
        print_fail("Failed to get appointments for cancellation test")
        return False
        
    apt = next((a for a in res["data"] if a["status"] == "confirmed"), None)
    if not apt:
        print_fail("No confirmed appointments found to cancel")
        return False
        
    # 3. Cancel appointment
    apt_id = apt["id"]
    status, res = make_request("PATCH", f"/api/appointments/{apt_id}", {
        "status": "cancelled",
        "cancellation_reason": "Integration Test Cancellation"
    })
    
    if status == 200 and res.get("success"):
        print_pass(f"Successfully cancelled appointment {apt_id}")
    else:
        print_fail(f"Failed to cancel appointment: {res}")
        return False
        
    # 4. Wait a moment and check recovery events
    time.sleep(1)
    status, res = make_request("GET", "/api/recovery/override")
    
    if status == 200 and res.get("data"):
        events = res["data"]
        matching_event = next((e for e in events if e["appointment_id"] == apt_id), None)
        if matching_event:
            print_pass(f"Recovery Wave automatically generated for {apt_id}")
            return apt_id
        else:
            print_fail("Recovery event was not created for the cancelled appointment")
            return False
    else:
        print_fail("Failed to fetch recovery events")
        return False

def test_atomic_slot_claim(apt_id):
    print("\n--- Testing Atomic Slot Claim (Race Condition) ---")
    
    results = []
    
    def claim_slot(patient_name):
        status, res = make_request("POST", "/api/claim-slot", {
            "appointment_id": apt_id,
            "patient_name": patient_name,
            "patient_phone": "+15551112222"
        })
        results.append({"name": patient_name, "status": status, "res": res})
        
    # Spawn two concurrent threads to claim the same slot
    t1 = threading.Thread(target=claim_slot, args=("Race Patient A",))
    t2 = threading.Thread(target=claim_slot, args=("Race Patient B",))
    
    t1.start(); t2.start()
    t1.join(); t2.join()
    
    success_count = sum(1 for r in results if r["status"] == 200)
    conflict_count = sum(1 for r in results if r["status"] == 409)
    
    if success_count == 1 and conflict_count == 1:
        print_pass("Atomic lock successful: 1 request succeeded, 1 request rejected with 409 Conflict")
        return True
    else:
        print_fail(f"Race condition failed. Successes: {success_count}, Conflicts: {conflict_count}")
        for r in results:
            print(f"  {r['name']} -> {r['status']} {r['res']}")
        return False

def test_settings_mutation():
    print("\n--- Testing Settings Mutation ---")
    payload = {
        "wave_size": 5,
        "wave_timeout_mins": 10,
        "auto_recovery_enabled": False
    }
    status, res = make_request("PATCH", "/api/settings", payload)
    
    if status == 200 and res.get("success"):
        updated = res["data"]
        if updated["wave_size"] == 5 and updated["auto_recovery_enabled"] is False:
            print_pass("Settings updated successfully")
            return True
        else:
            print_fail(f"Settings returned success but data didn't match: {updated}")
            return False
    else:
        print_fail(f"Settings update failed: {res}")
        return False

def run_all():
    print("Starting Deployment Integration Tests...")
    all_passed = True
    
    if not test_api_connectivity(): all_passed = False
    if not test_triage_and_waitlist(): all_passed = False
    
    apt_id = test_cancellation_and_recovery()
    if apt_id:
        if not test_atomic_slot_claim(apt_id): all_passed = False
    else:
        print_fail("Skipping Atomic Slot Claim due to earlier failure")
        all_passed = False
        
    if not test_settings_mutation(): all_passed = False
    
    print("\n" + "="*40)
    if all_passed:
        print(color("🎉 ALL INTEGRATION TESTS PASSED! READY FOR DEPLOYMENT.", "32;1"))
    else:
        print(color("❌ SOME TESTS FAILED. DO NOT DEPLOY.", "31;1"))
    print("="*40 + "\n")

if __name__ == "__main__":
    run_all()
