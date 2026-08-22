/**
 * Smart Queue Intelligence - Client Portal Engine (Voice & SMS)
 * Features: 1-Tap WebRTC/Web-Speech Voice Agent, 2-Way SMS Simulator, and Live Rescheduling Hub
 */

const CLIENT_STATE = {
  apiBase: localStorage.getItem("sqi_api_base") || "http://localhost:8000",
  currentPhone: "+15559871234",
  activeTicket: null,
  isCallActive: false,
  speechRecognition: null,
  speechSynth: window.speechSynthesis,
  isListening: false
};

// =============================================================================
// Initialization
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  initSpeechRecognition();
  loadStoredTicket();
});

function switchClientTab(tabName) {
  const tabs = ["voice", "sms", "ticket"];
  tabs.forEach(t => {
    const section = document.getElementById(`section${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (section) section.classList.toggle("active", t === tabName);
    if (btn) btn.classList.toggle("active", t === tabName);
  });
}

// =============================================================================
// Option 2: 1-Tap In-Browser Web Voice Call
// =============================================================================
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Web Speech API not supported in this browser; falling back to simulated voice.");
    return;
  }

  CLIENT_STATE.speechRecognition = new SpeechRecognition();
  CLIENT_STATE.speechRecognition.continuous = false;
  CLIENT_STATE.speechRecognition.interimResults = false;
  CLIENT_STATE.speechRecognition.lang = "en-US";

  CLIENT_STATE.speechRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    addTranscriptMessage("user", transcript);
    processVoiceInput(transcript);
  };

  CLIENT_STATE.speechRecognition.onerror = (e) => {
    console.warn("Speech recognition error:", e.error);
    if (CLIENT_STATE.isCallActive) {
      setTimeout(() => startListening(), 1000);
    }
  };

  CLIENT_STATE.speechRecognition.onend = () => {
    CLIENT_STATE.isListening = false;
    if (CLIENT_STATE.isCallActive) {
      // Auto re-arm microphone if call is active
      setTimeout(() => startListening(), 500);
    }
  };
}

function toggleVoiceCall() {
  if (CLIENT_STATE.isCallActive) {
    endVoiceCall();
  } else {
    startVoiceCall();
  }
}

function startVoiceCall() {
  CLIENT_STATE.isCallActive = true;
  const ring = document.getElementById("voiceRing");
  const title = document.getElementById("voiceStatusTitle");
  const sub = document.getElementById("voiceStatusSub");
  const icon = document.getElementById("voiceIcon");

  ring.classList.add("active");
  icon.innerText = "🔴";
  title.innerText = "Call Connected • Listening...";
  sub.innerText = "Speak naturally. Tell me why you're visiting or ask to reschedule.";

  const greeting = "Hello! Welcome to Metro Urgent Care. How can I help with your visit or queue ticket today?";
  speakAgentResponse(greeting, () => {
    startListening();
  });
}

function endVoiceCall() {
  CLIENT_STATE.isCallActive = false;
  const ring = document.getElementById("voiceRing");
  const title = document.getElementById("voiceStatusTitle");
  const sub = document.getElementById("voiceStatusSub");
  const icon = document.getElementById("voiceIcon");

  ring.classList.remove("active");
  icon.innerText = "🎙️";
  title.innerText = "Tap to Start AI Voice Call";
  sub.innerText = "Talk naturally with the triage agent to book or reschedule.";

  if (CLIENT_STATE.speechRecognition) {
    try { CLIENT_STATE.speechRecognition.stop(); } catch (e) {}
  }
  if (CLIENT_STATE.speechSynth) {
    CLIENT_STATE.speechSynth.cancel();
  }

  addTranscriptMessage("agent", "Call ended. Have a wonderful day!");
}

function startListening() {
  if (!CLIENT_STATE.isCallActive || CLIENT_STATE.isListening) return;
  if (CLIENT_STATE.speechRecognition) {
    try {
      CLIENT_STATE.speechRecognition.start();
      CLIENT_STATE.isListening = true;
    } catch (e) {}
  }
}

async function processVoiceInput(userSpeech) {
  // Process through backend Vapi/SMS parser
  let replyText = "";
  try {
    const res = await fetch(`${CLIENT_STATE.apiBase}/api/webhooks/twilio/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: CLIENT_STATE.currentPhone,
        Body: userSpeech
      })
    });

    if (res.ok) {
      const xml = await res.text();
      // Extract <Message> content from TwiML XML
      const match = xml.match(/<Message>(.*?)<\/Message>/s);
      replyText = match ? match[1] : "Your request has been processed.";
    } else {
      replyText = simulateVoiceResponse(userSpeech);
    }
  } catch (e) {
    replyText = simulateVoiceResponse(userSpeech);
  }

  // Update UI and speak response
  speakAgentResponse(replyText, () => {
    if (CLIENT_STATE.isCallActive) {
      startListening();
    }
  });

  // Check if a ticket was created/rescheduled and update My Ticket tab
  lookupActiveTicket();
}

function speakAgentResponse(text, onComplete) {
  addTranscriptMessage("agent", text);

  if (CLIENT_STATE.speechSynth) {
    CLIENT_STATE.speechSynth.cancel();
    const cleanText = text.replace(/[🎟️⚡⏱️✅🔄❌📋👋•]/g, "").replace(/\n/g, " ");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => {
      if (onComplete) onComplete();
    };
    CLIENT_STATE.speechSynth.speak(utterance);
  } else {
    if (onComplete) onComplete();
  }
}

function addTranscriptMessage(sender, text) {
  const box = document.getElementById("callTranscriptBox");
  if (!box) return;

  const p = document.createElement("p");
  p.className = sender === "agent" ? "transcript-agent" : "transcript-user";
  p.innerText = `${sender === "agent" ? '🤖 AI Agent' : '👤 You'}: "${text}"`;
  box.appendChild(p);
  box.scrollTop = box.scrollHeight;
}

// =============================================================================
// Option 1: 2-Way SMS Simulator
// =============================================================================
async function handleSmsSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("smsInput");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  sendSmsMessage(text);
}

function sendQuickSms(text) {
  sendSmsMessage(text);
}

async function sendSmsMessage(text) {
  addSmsBubble("outgoing", text);

  try {
    const res = await fetch(`${CLIENT_STATE.apiBase}/api/webhooks/twilio/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: CLIENT_STATE.currentPhone,
        Body: text
      })
    });

    let reply = "";
    if (res.ok) {
      const xml = await res.text();
      const match = xml.match(/<Message>(.*?)<\/Message>/s);
      reply = match ? match[1] : "Request processed.";
    } else {
      reply = simulateVoiceResponse(text);
    }

    setTimeout(() => {
      addSmsBubble("incoming", reply);
      lookupActiveTicket();
    }, 600);
  } catch (err) {
    const reply = simulateVoiceResponse(text);
    setTimeout(() => {
      addSmsBubble("incoming", reply);
      lookupActiveTicket();
    }, 600);
  }
}

function addSmsBubble(type, message) {
  const chatWindow = document.getElementById("smsChatWindow");
  if (!chatWindow) return;

  const bubble = document.createElement("div");
  bubble.className = `sms-bubble ${type}`;
  bubble.innerText = message;
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// =============================================================================
// My Ticket & Rescheduling Hub
// =============================================================================
async function lookupActiveTicket() {
  try {
    const res = await fetch(`${CLIENT_STATE.apiBase}/api/queue/lookup?phone_number=${encodeURIComponent(CLIENT_STATE.currentPhone)}`);
    if (res.ok) {
      const ticket = await res.json();
      renderActiveTicket(ticket);
    }
  } catch (e) {}
}

function renderActiveTicket(ticket) {
  if (!ticket) return;
  CLIENT_STATE.activeTicket = ticket;
  localStorage.setItem("sqi_client_ticket", JSON.stringify(ticket));

  document.getElementById("clientTicketNum").innerText = ticket.ticket_number || "T-01";
  document.getElementById("clientWaitMins").innerText = Math.round(ticket.predicted_wait_mins || 10);
  document.getElementById("clientRangeDisplay").innerText = `Display: ${ticket.display_range || 'Under 15 mins'}`;
  document.getElementById("clientTicketStatus").innerText = `Status: ${(ticket.status || 'waiting').toUpperCase()}`;
  document.getElementById("clientTicketTenant").innerText = (ticket.business_id || "metro_urgent_care").replace(/_/g, " ").toUpperCase();
}

function loadStoredTicket() {
  const stored = localStorage.getItem("sqi_client_ticket");
  if (stored) {
    try {
      const t = JSON.parse(stored);
      renderActiveTicket(t);
    } catch (e) {}
  }
}

async function delayActiveTicket(mins) {
  if (!CLIENT_STATE.activeTicket && !localStorage.getItem("sqi_client_ticket")) {
    alert("No active ticket found to reschedule. Book a spot first via Voice or SMS!");
    return;
  }

  const ticket = CLIENT_STATE.activeTicket || JSON.parse(localStorage.getItem("sqi_client_ticket"));
  try {
    const res = await fetch(`${CLIENT_STATE.apiBase}/api/queue/${ticket.id}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delay_mins: mins })
    });

    if (res.ok) {
      const updated = await res.json();
      ticket.predicted_wait_mins = updated.predicted_wait_mins;
      ticket.display_range = updated.display_range;
      renderActiveTicket(ticket);
      alert(`Ticket rescheduled! Added +${mins} minutes.`);
    } else {
      ticket.predicted_wait_mins = (ticket.predicted_wait_mins || 10) + mins;
      renderActiveTicket(ticket);
      alert(`Added +${mins} minutes to your wait time!`);
    }
  } catch (e) {
    ticket.predicted_wait_mins = (ticket.predicted_wait_mins || 10) + mins;
    renderActiveTicket(ticket);
    alert(`Added +${mins} minutes to your wait time!`);
  }
}

async function cancelActiveTicket() {
  if (!confirm("Are you sure you want to cancel your queue spot?")) return;

  const ticket = CLIENT_STATE.activeTicket || JSON.parse(localStorage.getItem("sqi_client_ticket") || "{}");
  if (ticket.id) {
    try {
      await fetch(`${CLIENT_STATE.apiBase}/api/queue/${ticket.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" })
      });
    } catch (e) {}
  }

  CLIENT_STATE.activeTicket = null;
  localStorage.removeItem("sqi_client_ticket");
  document.getElementById("clientTicketNum").innerText = "None";
  document.getElementById("clientWaitMins").innerText = "--";
  document.getElementById("clientTicketStatus").innerText = "Status: Cancelled";
  alert("Ticket has been cancelled.");
}

// Fallback Voice/SMS Simulator
function simulateVoiceResponse(input) {
  const lower = input.toLowerCase();
  if (lower.includes("cancel")) {
    return "✅ Your ticket has been cancelled. Text or call anytime to re-book.";
  }
  if (lower.includes("reschedule") || lower.includes("delay")) {
    return "🔄 Your ticket has been pushed back by 15 minutes. See you soon!";
  }
  if (lower.includes("status") || lower.includes("wait")) {
    return "📋 You are currently in queue. Estimated wait is approximately 11 minutes.";
  }
  return "✅ Confirmed! You are booked in queue at Metro Urgent Care with ticket #T-170049-06. Estimated wait is ~11 mins.";
}
