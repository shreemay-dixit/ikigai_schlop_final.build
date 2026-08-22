/**
 * Smart Queue Intelligence - Production Web Application Engine
 * Architecture: Dual-Mode (Live FastAPI REST + High-Fidelity Client-Side Simulator Fallback)
 */

// =============================================================================
// State Management
// =============================================================================
const STATE = {
  apiBase: localStorage.getItem("sqi_api_base") || "http://localhost:8000",
  engineMode: localStorage.getItem("sqi_engine_mode") || "auto", // 'auto' | 'live' | 'simulated'
  currentTenant: "metro_urgent_care",
  activeCounters: 3,
  nowServing: null,
  isLiveConnected: false,
  pollInterval: null,
  
  // Local In-Memory Fallback Queue (for instant responsiveness & offline/cloud demo)
  simulatedQueues: {
    metro_urgent_care: [
      { id: "sim-1", ticket_number: "T-170049-06", priority_score: 5, predicted_wait_mins: 11.3, display_range: "10 - 13 mins", status: "waiting", created_at: new Date(Date.now() - 180000).toISOString(), business_id: "metro_urgent_care", service_type: 2, party_size: 1, is_walk_in: 1 },
      { id: "sim-2", ticket_number: "T-170054-07", priority_score: 3, predicted_wait_mins: 14.5, display_range: "13 - 16 mins", status: "waiting", created_at: new Date(Date.now() - 120000).toISOString(), business_id: "metro_urgent_care", service_type: 1, party_size: 2, is_walk_in: 1 },
      { id: "sim-3", ticket_number: "T-170059-08", priority_score: 2, predicted_wait_mins: 18.0, display_range: "16 - 20 mins", status: "waiting", created_at: new Date(Date.now() - 60000).toISOString(), business_id: "metro_urgent_care", service_type: 0, party_size: 1, is_walk_in: 0 }
    ],
    city_dmv: [
      { id: "sim-4", ticket_number: "T-170103-10", priority_score: 4, predicted_wait_mins: 6.2, display_range: "5 - 8 mins", status: "waiting", created_at: new Date(Date.now() - 90000).toISOString(), business_id: "city_dmv", service_type: 1, party_size: 1, is_walk_in: 1 }
    ],
    apex_commercial_bank: [],
    golden_bistro: [],
    telecom_store: []
  },

  tenantMetadata: {
    metro_urgent_care: { name: "Metro Urgent Care (ER)", industry: "Healthcare", baseVelocity: 14.0, counters: 3 },
    city_dmv: { name: "City DMV Licensing", industry: "Government", baseVelocity: 8.5, counters: 4 },
    apex_commercial_bank: { name: "Apex Commercial Bank", industry: "Banking", baseVelocity: 11.0, counters: 2 },
    golden_bistro: { name: "Golden Bistro", industry: "Hospitality", baseVelocity: 25.0, counters: 5 },
    telecom_store: { name: "Apex Telecom Support", industry: "Retail/Tech", baseVelocity: 10.0, counters: 2 }
  }
};

// =============================================================================
// Initialization & Navigation
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("apiUrlInput").value = STATE.apiBase;
  document.getElementById("modeToggle").value = STATE.engineMode;
  
  onTenantChange(STATE.currentTenant);
  checkBackendHealth();
  
  // Setup continuous polling
  if (STATE.pollInterval) clearInterval(STATE.pollInterval);
  STATE.pollInterval = setInterval(() => {
    refreshQueueData();
  }, 4000);
});

function switchView(viewName) {
  const views = ["intake", "staff", "telemetry", "display"];
  views.forEach(v => {
    const section = document.getElementById(`view${v.charAt(0).toUpperCase() + v.slice(1)}`);
    const btn = document.getElementById(`nav${v.charAt(0).toUpperCase() + v.slice(1)}`);
    if (section) section.classList.toggle("active", v === viewName);
    if (btn) btn.classList.toggle("active", v === viewName);
  });

  if (viewName === "display") {
    updateTvDisplay();
  }
}

function onTenantChange(tenantId) {
  STATE.currentTenant = tenantId;
  const meta = STATE.tenantMetadata[tenantId] || { name: tenantId, counters: 3 };
  STATE.activeCounters = meta.counters;
  
  document.getElementById("intakeTenantDisplay").value = tenantId;
  document.getElementById("resTenantName").innerText = meta.name;
  document.getElementById("staffTenantName").innerText = meta.name;
  document.getElementById("tvTenantHeader").innerText = `${meta.name} - Waiting Room Monitor`;
  document.getElementById("stepperCounterVal").innerText = STATE.activeCounters;
  document.getElementById("kpiActiveCounters").innerText = STATE.activeCounters;

  refreshQueueData();
}

// =============================================================================
// Multilingual Scenario Presets
// =============================================================================
const PRESETS = {
  spanish_er: {
    tenant: "metro_urgent_care",
    text: "Mi abuela tiene un dolor en el pecho muy fuerte y no puede respirar bien, acabamos de llegar.",
    phone: "+1 (555) 987-1234"
  },
  hindi_bank: {
    tenant: "apex_commercial_bank",
    text: "मुझे अपने नए व्यवसाय के लिए एक करंट अकाउंट खोलना है और कमर्शियल लोन के बारे में सलाह चाहिए।",
    phone: "+91 98765 43210"
  },
  french_bistro: {
    tenant: "golden_bistro",
    text: "Une table pour quatre personnes pour fêter un anniversaire de mariage, nous avons réservé la semaine dernière.",
    phone: "+33 6 12 34 56 78"
  },
  japanese_dmv: {
    tenant: "city_dmv",
    text: "運転免許証の更新手続きに来ました。事前予約済みです。",
    phone: "+81 90-1234-5678"
  },
  english_ada: {
    tenant: "city_dmv",
    text: "I need urgent wheelchair ADA accessibility assistance for medical transport driver license verification.",
    phone: "+1 (555) 302-8844"
  }
};

function applyPreset(key) {
  const p = PRESETS[key];
  if (!p) return;
  
  const tenantSelect = document.getElementById("tenantSelect");
  tenantSelect.value = p.tenant;
  onTenantChange(p.tenant);

  document.getElementById("intakeUserText").value = p.text;
  document.getElementById("intakePhone").value = p.phone;

  showToast(`Loaded Preset: ${key.replace('_', ' ').toUpperCase()}`, "info");
}

// =============================================================================
// API & Health Probing
// =============================================================================
async function checkBackendHealth() {
  const statusBadge = document.getElementById("systemStatusText");
  const pulseDot = document.getElementById("systemPulse");

  if (STATE.engineMode === "simulated") {
    STATE.isLiveConnected = false;
    statusBadge.innerText = "Simulator (Standalone)";
    pulseDot.className = "pulse-dot simulated";
    return;
  }

  try {
    const res = await fetch(`${STATE.apiBase}/api/health`, { method: "GET", signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      STATE.isLiveConnected = true;
      statusBadge.innerText = `Live API Online (ML: ${data.ml_model_loaded ? 'Active' : 'Fallback'})`;
      pulseDot.className = "pulse-dot";
    } else {
      throw new Error("Bad status");
    }
  } catch (err) {
    STATE.isLiveConnected = false;
    if (STATE.engineMode === "live") {
      statusBadge.innerText = "API Offline";
      pulseDot.className = "pulse-dot offline";
    } else {
      statusBadge.innerText = "Simulator (API Fallback)";
      pulseDot.className = "pulse-dot simulated";
    }
  }
}

// =============================================================================
// Customer Intake & Triage Submission
// =============================================================================
async function handleIntakeSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("btnIntakeSubmit");
  const userText = document.getElementById("intakeUserText").value.trim();
  const phone = document.getElementById("intakePhone").value.trim() || null;

  if (!userText) {
    showToast("Please enter customer description or speech.", "warning");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = "<span>⏳ Analyzing Multilingual Intent & Queuing...</span>";

  try {
    let resultData = null;

    if (STATE.isLiveConnected && STATE.engineMode !== "simulated") {
      const res = await fetch(`${STATE.apiBase}/api/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: STATE.currentTenant,
          user_text: userText,
          phone_number: phone
        })
      });
      if (!res.ok) throw new Error(await res.text());
      resultData = await res.json();
    } else {
      // High-Fidelity Client-Side Simulation
      resultData = simulateIntake(STATE.currentTenant, userText, phone);
    }

    displayTicketResult(resultData);
    showToast(`Ticket ${resultData.ticket_number} Created Successfully!`, "success");
    playChime(660, 0.15);

    // Refresh tables
    refreshQueueData();

    // Clear text
    document.getElementById("intakeUserText").value = "";
  } catch (err) {
    console.error("Intake Error:", err);
    showToast(`Intake failed: ${err.message}`, "danger");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "<span>⚡ Run AI Triage & Issue Ticket</span>";
  }
}

function displayTicketResult(data) {
  document.getElementById("resTicketNum").innerText = data.ticket_number;
  document.getElementById("resWaitVal").innerText = `${data.predicted_wait_mins.toFixed(1)}m`;
  document.getElementById("resRangePill").innerText = `Estimated Range: ${data.display_range}`;
  document.getElementById("ticketGenTime").innerText = new Date(data.created_at).toLocaleTimeString();

  const priorityScore = data.priority_score || 1;
  const chip = document.getElementById("resPriorityChip");
  chip.className = `priority-chip p-${priorityScore}`;
  chip.innerText = `Priority: ${priorityScore} / 5 ${priorityScore >= 4 ? '🔥 High Urgency' : ''}`;

  const extracted = data.extracted_features || {};
  document.getElementById("resServiceType").innerText = `Tier ${extracted.service_type ?? 1} (${extracted.service_type === 2 ? 'Complex' : extracted.service_type === 0 ? 'Express' : 'Standard'})`;
  document.getElementById("resPartyWalkin").innerText = `Party of ${extracted.party_size ?? 1} • ${extracted.is_walk_in === 0 ? 'Pre-Booked' : 'Walk-in'}`;
  document.getElementById("resEngineTier").innerText = extracted.extracted_by ? `Engine: ${extracted.extracted_by}` : "Gemini 3-Tier AI";

  const baseline = data.queuing_theory_baseline_mins || (data.predicted_wait_mins * 0.9);
  const residual = data.predicted_wait_mins - baseline;
  document.getElementById("xaiTheoretical").innerText = `${baseline.toFixed(1)} mins`;
  document.getElementById("xaiResidual").innerText = `${residual >= 0 ? '+' : ''}${residual.toFixed(1)} mins`;
}

// =============================================================================
// Queue Data Refresh & Operations
// =============================================================================
async function refreshQueueData() {
  let queueList = [];
  let waitingCount = 0;
  let activeCounters = STATE.activeCounters;
  let rollingVel = STATE.tenantMetadata[STATE.currentTenant]?.baseVelocity || 12.0;
  let arrivalRate = 0.25;
  let rho = 0.35;

  if (STATE.isLiveConnected && STATE.engineMode !== "simulated") {
    try {
      const res = await fetch(`${STATE.apiBase}/api/queue/${STATE.currentTenant}`);
      if (res.ok) {
        const snap = await res.json();
        queueList = snap.queue_entries || [];
        waitingCount = snap.waiting_count;
        activeCounters = snap.active_counters;
        rollingVel = snap.rolling_velocity_mins;
        arrivalRate = snap.arrival_rate_lambda_per_min;
        rho = snap.system_utilization_rho;
      }
    } catch (e) {
      console.warn("Falling back to local data during refresh");
      queueList = STATE.simulatedQueues[STATE.currentTenant] || [];
      waitingCount = queueList.filter(q => q.status === "waiting").length;
    }
  } else {
    queueList = STATE.simulatedQueues[STATE.currentTenant] || [];
    waitingCount = queueList.filter(q => q.status === "waiting").length;
    arrivalRate = +(waitingCount * 0.12).toFixed(2);
    const mu = 1.0 / Math.max(0.5, rollingVel);
    rho = +(arrivalRate / (activeCounters * mu)).toFixed(2);
  }

  // Update Telemetry Bar
  document.getElementById("kpiWaitingCount").innerText = waitingCount;
  document.getElementById("kpiActiveCounters").innerText = activeCounters;
  document.getElementById("kpiUtilization").innerText = rho.toFixed(2);
  document.getElementById("kpiRollingVelocity").innerText = rollingVel.toFixed(1);
  document.getElementById("kpiArrivalRate").innerText = arrivalRate.toFixed(2);

  // Update Gauge
  const gaugeFill = document.getElementById("gaugeFill");
  const gaugeVal = document.getElementById("gaugeVal");
  const gaugeDesc = document.getElementById("gaugeStatusText");
  const kpiDesc = document.getElementById("kpiUtilizationDesc");

  if (gaugeFill && gaugeVal) {
    gaugeVal.innerText = rho.toFixed(2);
    const pct = Math.min(100, Math.max(5, rho * 100));
    gaugeFill.style.width = `${pct}%`;

    if (rho >= 1.0) {
      gaugeDesc.innerText = "🚨 Critical Bottleneck (Arrivals exceed service capacity: ρ ≥ 1.0)";
      gaugeDesc.style.color = "var(--accent-rose)";
      kpiDesc.innerHTML = `<span style="color: var(--accent-rose);">⚠️ Overloaded ($\rho \ge 1.0$)</span>`;
    } else if (rho >= 0.8) {
      gaugeDesc.innerText = "⚡ Heavy Load (High queue dwell time: 0.80 ≤ ρ < 1.0)";
      gaugeDesc.style.color = "var(--accent-amber)";
      kpiDesc.innerHTML = `<span style="color: var(--accent-amber);">⚡ Heavy Load</span>`;
    } else {
      gaugeDesc.innerText = "✅ Operating in Stable Region (Optimal ρ < 0.80)";
      gaugeDesc.style.color = "var(--accent-emerald)";
      kpiDesc.innerHTML = `<span>Normal Stability</span>`;
    }
  }

  // Render Queue Table
  renderQueueTable(queueList);
  updateTvDisplay(queueList);
}

function renderQueueTable(queueList) {
  const tbody = document.getElementById("queueTableBody");
  const badge = document.getElementById("liveQueueCountBadge");
  const waitingOnly = queueList.filter(q => q.status === "waiting");
  
  badge.innerText = `${waitingOnly.length} Waiting`;

  if (queueList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          No waiting customers in queue. Issue tickets from the Intake kiosk!
        </td>
      </tr>
    `;
    return;
  }

  // Sort: waiting items first (by priority desc, created_at asc), then others
  const sorted = [...queueList].sort((a, b) => {
    if (a.status === "waiting" && b.status !== "waiting") return -1;
    if (b.status === "waiting" && a.status !== "waiting") return 1;
    if (a.status === "waiting" && b.status === "waiting") {
      if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
      return new Date(a.created_at) - new Date(b.created_at);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  tbody.innerHTML = sorted.map(t => `
    <tr>
      <td class="ticket-mono">${t.ticket_number}</td>
      <td>
        <span class="priority-chip p-${t.priority_score}">P-${t.priority_score}</span>
      </td>
      <td>${t.predicted_wait_mins.toFixed(1)} mins <small style="color: var(--text-muted);">(${t.display_range})</small></td>
      <td><span class="status-tag ${t.status}">${t.status.replace('_', ' ')}</span></td>
      <td style="font-size: 0.75rem; color: var(--text-muted);">${new Date(t.created_at).toLocaleTimeString()}</td>
      <td>
        <div class="table-actions">
          ${t.status === 'waiting' ? `
            <button class="btn-icon" title="Serve Now" onclick="updateTicketStatus('${t.id}', 'in_progress')">▶️ Serve</button>
          ` : ''}
          ${t.status === 'in_progress' ? `
            <button class="btn-icon" title="Mark Completed" onclick="updateTicketStatus('${t.id}', 'completed')" style="color: var(--accent-emerald);">✅ Done</button>
          ` : ''}
          ${t.status !== 'completed' ? `
            <button class="btn-icon" title="Cancel/No-Show" onclick="updateTicketStatus('${t.id}', 'no_show')" style="color: var(--accent-rose);">❌</button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join("");
}

// =============================================================================
// Staff "Call Next" & Status Transition
// =============================================================================
async function callNextTicket() {
  const btn = document.getElementById("btnCallNext");
  btn.disabled = true;

  try {
    let nextTicket = null;

    if (STATE.isLiveConnected && STATE.engineMode !== "simulated") {
      const res = await fetch(`${STATE.apiBase}/api/queue/${STATE.currentTenant}/next`);
      if (res.status === 404) {
        showToast("Queue is currently empty!", "warning");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      nextTicket = await res.json();
      
      // Advance to in_progress
      await fetch(`${STATE.apiBase}/api/queue/${nextTicket.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" })
      });
    } else {
      // Local Simulator Next
      const list = (STATE.simulatedQueues[STATE.currentTenant] || []).filter(q => q.status === "waiting");
      if (list.length === 0) {
        showToast("Queue is currently empty!", "warning");
        return;
      }
      list.sort((a, b) => (b.priority_score - a.priority_score) || (new Date(a.created_at) - new Date(b.created_at)));
      nextTicket = list[0];
      nextTicket.status = "in_progress";
    }

    STATE.nowServing = nextTicket;
    document.getElementById("nowServingTicket").innerText = `${nextTicket.ticket_number} (P-${nextTicket.priority_score})`;
    document.getElementById("tvNowServing").innerText = nextTicket.ticket_number;
    
    // Play announcement chime
    playAnnouncementChime();
    showToast(`🔔 Now Serving: Ticket ${nextTicket.ticket_number} at Counter 1!`, "success");

    refreshQueueData();
  } catch (err) {
    showToast(`Error calling next: ${err.message}`, "danger");
  } finally {
    btn.disabled = false;
  }
}

async function updateTicketStatus(ticketId, newStatus) {
  try {
    if (STATE.isLiveConnected && STATE.engineMode !== "simulated") {
      const res = await fetch(`${STATE.apiBase}/api/queue/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error(await res.text());
    } else {
      const list = STATE.simulatedQueues[STATE.currentTenant] || [];
      const item = list.find(q => q.id === ticketId);
      if (item) item.status = newStatus;
    }

    showToast(`Ticket status updated to ${newStatus}`, "info");
    refreshQueueData();
  } catch (e) {
    showToast(`Failed to update status: ${e.message}`, "danger");
  }
}

// =============================================================================
// Counter Capacity Adjustment
// =============================================================================
function adjustCounters(delta) {
  const newVal = Math.max(1, Math.min(20, STATE.activeCounters + delta));
  STATE.activeCounters = newVal;
  document.getElementById("stepperCounterVal").innerText = newVal;
  document.getElementById("kpiActiveCounters").innerText = newVal;
}

async function saveCounters() {
  try {
    if (STATE.isLiveConnected && STATE.engineMode !== "simulated") {
      const res = await fetch(`${STATE.apiBase}/api/tenants/${STATE.currentTenant}/counters`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active_counters: STATE.activeCounters })
      });
      if (!res.ok) throw new Error(await res.text());
    }
    
    if (STATE.tenantMetadata[STATE.currentTenant]) {
      STATE.tenantMetadata[STATE.currentTenant].counters = STATE.activeCounters;
    }

    showToast(`Active counters updated to ${STATE.activeCounters}!`, "success");
    refreshQueueData();
  } catch (e) {
    showToast(`Error updating counters: ${e.message}`, "danger");
  }
}

// =============================================================================
// Waiting Room TV Mode Display
// =============================================================================
function updateTvDisplay(queueList) {
  const list = queueList || (STATE.simulatedQueues[STATE.currentTenant] || []);
  const waiting = list.filter(q => q.status === "waiting");
  
  // Sort by priority desc
  waiting.sort((a, b) => (b.priority_score - a.priority_score) || (new Date(a.created_at) - new Date(b.created_at)));

  const container = document.getElementById("tvNextList");
  if (!container) return;

  if (waiting.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); padding: 1rem;">No other customers waiting</div>`;
    return;
  }

  container.innerHTML = waiting.slice(0, 5).map(item => `
    <div class="tv-next-item">
      <span>${item.ticket_number} <small style="font-size: 0.75rem; color: var(--text-muted);">(P-${item.priority_score})</small></span>
      <span style="color: var(--accent-cyan); font-size: 0.95rem;">~${item.predicted_wait_mins.toFixed(0)} mins</span>
    </div>
  `).join("");
}

// =============================================================================
// High-Fidelity Client-Side Mathematical Simulator
// =============================================================================
function simulateIntake(tenantId, userText, phone) {
  const lower = userText.toLowerCase();
  let priority = 1;
  let serviceType = 1;
  let isWalkin = 1;
  let partySize = 1;

  // NLP Intent Classification Heuristics
  if (lower.includes("chest pain") || lower.includes("pecho") || lower.includes("respirar") || lower.includes("emergency") || lower.includes("urgent") || lower.includes("wheelchair") || lower.includes("ada")) {
    priority = 5;
    serviceType = 2;
  } else if (lower.includes("loan") || lower.includes("कमर्शियल") || lower.includes("current account") || lower.includes("anniversary") || lower.includes("vip")) {
    priority = (lower.includes("anniversary") || lower.includes("vip")) ? 4 : 3;
    serviceType = 2;
  } else if (lower.includes("renew") || lower.includes("licence") || lower.includes("license") || lower.includes("更新") || lower.includes("drop off")) {
    priority = lower.includes("drop") ? 1 : 2;
    serviceType = 0;
  }

  if (lower.includes("quatre") || lower.includes("four") || lower.includes("4") || lower.includes("party")) {
    partySize = 4;
  }

  if (lower.includes("reserv") || lower.includes("booked") || lower.includes("事前予約") || lower.includes("appointment")) {
    isWalkin = 0;
  }

  const queue = STATE.simulatedQueues[tenantId] || [];
  const waitingLen = queue.filter(q => q.status === "waiting").length;
  const activeC = STATE.activeCounters;
  const baseVel = STATE.tenantMetadata[tenantId]?.baseVelocity || 12.0;

  // Erlang-C Baseline approximation
  const baseline = Math.max(2.0, (waitingLen / activeC) * baseVel * (1.1 - (priority * 0.1)));
  // Random Forest residual heuristic
  const residual = (priority === 5 ? -1.5 : (serviceType === 2 ? 1.2 : -0.5)) + (partySize > 1 ? 1.5 : 0);
  const predicted = Math.max(1.0, +(baseline + residual).toFixed(1));

  let range = "Under 5 mins";
  if (predicted >= 5 && predicted < 10) range = `${Math.floor(predicted - 1)} - ${Math.ceil(predicted + 2)} mins`;
  else if (predicted >= 10) range = `${Math.floor(predicted - 2)} - ${Math.ceil(predicted + 3)} mins`;

  const now = new Date();
  const ticketNum = `T-${now.toTimeString().split(' ')[0].replace(/:/g, '')}-${(waitingLen + 1).toString().padStart(2, '0')}`;

  const newTicket = {
    id: `sim-${Date.now()}`,
    business_id: tenantId,
    ticket_number: ticketNum,
    phone_number: phone,
    priority_score: priority,
    predicted_wait_mins: predicted,
    display_range: range,
    queuing_theory_baseline_mins: +baseline.toFixed(1),
    status: "waiting",
    created_at: now.toISOString(),
    extracted_features: {
      service_type: serviceType,
      priority_score: priority,
      is_walk_in: isWalkin,
      party_size: partySize,
      extracted_by: "simulator_rule_engine"
    }
  };

  if (!STATE.simulatedQueues[tenantId]) STATE.simulatedQueues[tenantId] = [];
  STATE.simulatedQueues[tenantId].push(newTicket);

  return newTicket;
}

function populateDemoBatch() {
  const samples = [
    { text: "Emergency triage for sharp abdominal pain and dizziness.", phone: "+1 (555) 441-2399" },
    { text: "Routine identification card renewal with pre-existing booking.", phone: "+1 (555) 120-9988" },
    { text: "General service question about account balance and statements.", phone: "+1 (555) 887-3211" }
  ];
  samples.forEach(s => simulateIntake(STATE.currentTenant, s.text, s.phone));
  showToast("Injected 3 sample tickets into queue!", "info");
  refreshQueueData();
}

function clearTenantQueue() {
  if (STATE.simulatedQueues[STATE.currentTenant]) {
    STATE.simulatedQueues[STATE.currentTenant] = STATE.simulatedQueues[STATE.currentTenant].filter(q => q.status === "waiting");
  }
  showToast("Cleared inactive entries!", "info");
  refreshQueueData();
}

// =============================================================================
// Audio Synthesis (Web Audio API)
// =============================================================================
function playChime(freq = 520, duration = 0.2) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playAnnouncementChime() {
  playChime(587.33, 0.18); // D5
  setTimeout(() => playChime(880.00, 0.35), 200); // A5
}

// =============================================================================
// UI Helpers (Modals & Toasts)
// =============================================================================
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add("active");
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("active");
}

function saveSettings() {
  const apiVal = document.getElementById("apiUrlInput").value.trim().replace(/\/$/, "");
  const modeVal = document.getElementById("modeToggle").value;
  STATE.apiBase = apiVal;
  STATE.engineMode = modeVal;
  localStorage.setItem("sqi_api_base", apiVal);
  localStorage.setItem("sqi_engine_mode", modeVal);

  closeModal("settingsModal");
  showToast("Settings saved. Reconnecting...", "info");
  checkBackendHealth();
  refreshQueueData();
}

function toggleEngineMode(mode) {
  STATE.engineMode = mode;
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  else if (type === "warning") icon = "⚠️";
  else if (type === "danger") icon = "🚨";

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
