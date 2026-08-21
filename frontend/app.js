const API_BASE = "http://127.0.0.1:8000";

function switchTab(tabName) {
    document.getElementById("btnTabNatural").classList.toggle("active", tabName === "natural");
    document.getElementById("btnTabStructured").classList.toggle("active", tabName === "structured");
    document.getElementById("tabNatural").classList.toggle("active", tabName === "natural");
    document.getElementById("tabStructured").classList.toggle("active", tabName === "structured");
}

async function checkHealth() {
    try {
        const res = await fetch(`${API_BASE}/`);
        if (res.ok) {
            const data = await res.json();
            document.getElementById("statusTitle").innerText = "System Online";
            document.getElementById("statusDetail").innerText = `API: Active • ML Model: ${data.model_loaded ? "Ready" : "Fallback"}`;
        }
    } catch (e) {
        document.getElementById("statusTitle").innerText = "API Offline";
        document.getElementById("statusDetail").innerText = "Ensure uvicorn is running on port 8000";
    }
}

function updateDashboardResults(data) {
    document.getElementById("estimatedWaitVal").innerText = data.estimated_wait_mins;
    document.getElementById("lastUpdated").innerText = new Date().toLocaleTimeString();
    
    if (data.confidence_interval) {
        document.getElementById("confidenceRange").innerText = 
            `Confidence: ${data.confidence_interval.lower_bound_mins} - ${data.confidence_interval.upper_bound_mins} mins`;
    }

    const xai = data.explainable_ai_breakdown;
    if (xai) {
        document.getElementById("baselineStat").innerText = `${xai.deterministic_queuing_baseline_mins} mins`;
        document.getElementById("residualStat").innerText = `${xai.learned_human_variance_residual_mins > 0 ? "+" : ""}${xai.learned_human_variance_residual_mins} mins`;
        document.getElementById("utilizationStat").innerText = xai.system_utilization_rho;

        document.getElementById("posWaitVal").innerText = `${xai.discrete_positional_wait_mins} mins`;
        document.getElementById("erlangWaitVal").innerText = `${xai.erlang_c_steady_state_wait_mins} mins`;
        document.getElementById("rfResidualVal").innerText = `${xai.learned_human_variance_residual_mins > 0 ? "+" : ""}${xai.learned_human_variance_residual_mins} mins`;
    }

    const extractionCard = document.getElementById("geminiExtractionCard");
    const chipsContainer = document.getElementById("featuresChips");
    if (data.extracted_features) {
        extractionCard.style.display = "block";
        chipsContainer.innerHTML = Object.entries(data.extracted_features)
            .map(([k, v]) => `<div class="chip"><strong>${k}:</strong> ${v}</div>`)
            .join("");
    } else {
        extractionCard.style.display = "none";
    }
}

async function submitNaturalIntake() {
    const btn = document.getElementById("btnSubmitNatural");
    const user_text = document.getElementById("naturalUserText").value;
    const tenant_persona = document.getElementById("tenantPersona").value;
    const queue_length_ahead = parseInt(document.getElementById("natQueueAhead").value) || 0;
    const active_counters = parseInt(document.getElementById("natActiveCounters").value) || 1;

    if (!user_text.trim()) {
        alert("Please enter customer intake text.");
        return;
    }

    btn.disabled = true;
    btn.querySelector(".btn-text").innerText = "Analyzing Intent & Queuing...";

    try {
        const response = await fetch(`${API_BASE}/intake/natural`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_text,
                tenant_persona,
                queue_length_ahead,
                active_counters
            })
        });
        const data = await response.json();
        updateDashboardResults(data);
    } catch (err) {
        alert("Error connecting to backend API. Please make sure the FastAPI server is running.");
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.querySelector(".btn-text").innerText = "Intake & Predict Wait Time";
    }
}

async function submitStructuredIntake() {
    const btn = document.getElementById("btnSubmitStructured");
    const payload = {
        service_type: parseInt(document.getElementById("serviceType").value),
        priority_score: parseInt(document.getElementById("priorityScore").value),
        is_walk_in: parseInt(document.getElementById("isWalkIn").value),
        party_size: parseInt(document.getElementById("partySize").value) || 1,
        age_bracket: parseInt(document.getElementById("ageBracket").value),
        queue_length_ahead: parseInt(document.getElementById("structQueueAhead").value) || 0,
        active_counters: parseInt(document.getElementById("structActiveCounters").value) || 1
    };

    btn.disabled = true;
    btn.innerText = "Computing...";

    try {
        const response = await fetch(`${API_BASE}/intake`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        updateDashboardResults(data);
    } catch (err) {
        alert("Error connecting to backend API.");
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerText = "Compute Hybrid Estimate";
    }
}

// Initial health check on page load
window.addEventListener("DOMContentLoaded", checkHealth);
