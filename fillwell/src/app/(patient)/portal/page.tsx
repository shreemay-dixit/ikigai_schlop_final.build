"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Radio, Zap, CheckCircle2, XCircle, User, Phone,
  ChevronRight, ShieldCheck, RotateCcw, Loader2,
  HeartPulse, Clock, Sparkles, AlertTriangle, Send,
  BrainCircuit, Code, FileJson, Database, Terminal,
  ChevronDown, ChevronUp, Calendar, Info, HelpCircle,
  Settings
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { SettingsModal } from "@/components/dashboard/SettingsModal";

type PortalState = "onboarding" | "radar" | "race" | "secured" | "lost";

interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  timestamp: string;
  triageData?: any;
}

export default function DigitalBuzzerPortal() {
  const [state, setState] = useState<PortalState>("onboarding");
  const [inputMode, setInputMode] = useState<"ai_chat" | "form">("ai_chat");

  // Patient & Triage Context
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("+1 (555) 019-2834");
  const [urgencyTier, setUrgencyTier] = useState<"urgent" | "moderate" | "routine">("urgent");
  const [priorityScore, setPriorityScore] = useState<number>(5);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [isCompleteTriage, setIsCompleteTriage] = useState(false);
  const [missingInfo, setMissingInfo] = useState<string[]>([]);
  const [suggestedSteps, setSuggestedSteps] = useState<string[]>([]);
  const [calendarContext, setCalendarContext] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Chat History
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "ai",
      text: "👋 Hello! I'm your Fillwell AI Clinical Assistant. I'm aware of today's schedule and live queue. Tell me how you're feeling or what you need, and I'll help triage you onto our live standby radar.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  // Behind the Scenes / Inspector State
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"gemini_json" | "calendar_context" | "db_sync" | "prompt_input">("gemini_json");
  const [lastGeminiPrompt, setLastGeminiPrompt] = useState<string>("");
  const [lastGeminiOutput, setLastGeminiOutput] = useState<any>(null);
  const [lastDbPayload, setLastDbPayload] = useState<any>(null);

  // Slot & Atomic Lock State
  const [openSlot, setOpenSlot] = useState<any>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimErrorMessage, setClaimErrorMessage] = useState("");
  const [connected, setConnected] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSubmitting]);

  // Restore saved patient session on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fillwell_buzzer_patient");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) {
          setPatientName(parsed.name);
          setPatientPhone(parsed.phone || "+1 (555) 019-2834");
          setState("radar");
        }
      }
    } catch {}
  }, []);

  // Quick Action Chips for Fast Testing
  const SUGGESTED_PROMPTS = [
    { label: "🚨 Acute Chest Pain & Shortness of Breath", text: "I have acute chest pain and shortness of breath since 20 mins, my name is Alex Morgan" },
    { label: "⚡ High Fever (102°F) & Migraine", text: "Fever 102°F with severe migraine and nausea since last night, patient Alex Morgan" },
    { label: "🗓️ Routine Physical & Blood Pressure Check", text: "I need to schedule a routine blood pressure and physical review, my name is Alex Morgan" },
    { label: "💬 Casual Vague Input (Test Chatbot Guidance)", text: "Hi, I feel unwell, are you open today?" },
  ];

  // ══════════════════════════════════════════════════════════════════
  // AI Triage Chat Execution (Calls Gemini API with Calendar Context)
  // ══════════════════════════════════════════════════════════════════
  const handleSendChatMessage = async (customText?: string) => {
    const textToSend = (customText || chatInput).trim();
    if (!textToSend || isSubmitting) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsSubmitting(true);

    const historyArray = messages.map((m) => `${m.sender.toUpperCase()}: ${m.text}`);
    historyArray.push(`USER: ${textToSend}`);

    const promptPayload = {
      transcript: textToSend,
      conversation_history: historyArray.slice(-6),
      channel: "mobile_web_chat",
      timestamp: new Date().toISOString(),
    };
    setLastGeminiPrompt(JSON.stringify(promptPayload, null, 2));

    try {
      const res = await fetch("/api/gemini/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promptPayload),
      });

      const json = await res.json();
      const ai = json.data;

      if (!ai) throw new Error("Empty response from AI engine");

      setLastGeminiOutput(ai);
      setCalendarContext(ai.calendar_context || null);
      setIsCompleteTriage(Boolean(ai.is_complete_triage));
      setMissingInfo(ai.missing_information || []);
      setSuggestedSteps(ai.suggested_next_steps || []);

      // Auto-extract Name & Phone & Urgency if available
      if (ai.patient_name && ai.patient_name !== "Patient") {
        setPatientName(ai.patient_name);
      }
      if (ai.patient_phone && !ai.patient_phone.includes("555-000")) {
        setPatientPhone(ai.patient_phone);
      }
      if (ai.urgency_tier) setUrgencyTier(ai.urgency_tier);
      if (ai.priority_score) setPriorityScore(ai.priority_score);
      if (ai.extracted_symptoms) setSymptoms(ai.extracted_symptoms);

      const aiReplyMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: ai.conversational_reply || `Thank you. I have triaged your request as ${ai.urgency_tier?.toUpperCase()} priority.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        triageData: ai,
      };

      setMessages((prev) => [...prev, aiReplyMsg]);

      if (ai.is_complete_triage) {
        toast.success(`Gemini AI: Complete ${ai.urgency_tier?.toUpperCase()} Triage (Score ${ai.priority_score}/5)`);
      } else {
        toast.info("Gemini Chatbot: Guiding you to complete intake details.");
      }
    } catch (err: any) {
      toast.error("Failed to connect to Gemini Triage service");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "ai",
          text: "I had trouble processing that with Gemini. You can also use the direct form to join the radar.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // STATE A -> B: Enter Standby Radar with Waitlist Write
  // ══════════════════════════════════════════════════════════════════
  const handleJoinStandby = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = patientName.trim() || "Alex Morgan";
    const finalPhone = patientPhone.trim() || "+1 (555) 019-2834";

    setIsSubmitting(true);

    const waitlistPayload = {
      patient_name: finalName,
      patient_phone: finalPhone,
      urgency_tier: urgencyTier,
      priority_score: priorityScore,
      notes: symptoms.length > 0 ? `Gemini NLP: ${symptoms.join(", ")}` : "Self-registered via Mobile Standby Radar",
      preferred_time_windows: ["mornings", "afternoons"],
      preferred_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    };

    setLastDbPayload(waitlistPayload);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(waitlistPayload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to join waitlist");
      }

      localStorage.setItem(
        "fillwell_buzzer_patient",
        JSON.stringify({ name: finalName, phone: finalPhone })
      );

      toast.success(`Joined Standby Radar as ${finalName}!`);
      setState("radar");
    } catch (err: any) {
      toast.error(err.message || "Failed to join standby queue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // STATE B & C: Real-Time Cancellation Listener (Radar -> Race)
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (state !== "radar" && state !== "race") return;

    const checkOpenSlots = async () => {
      try {
        const res = await fetch("/api/appointments");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const availableSlot = json.data.find(
            (a: any) => a.status === "cancelled" || a.status === "recovering"
          );

          if (availableSlot && state === "radar") {
            setOpenSlot(availableSlot);
            setState("race");
            toast.info("🚨 SLOT OPENED! Claim now before others!");
          } else if (!availableSlot && state === "race") {
            setState("radar");
            setOpenSlot(null);
          }
        }
      } catch {}
    };

    checkOpenSlots();

    // Supabase Realtime channel subscription
    const channel = supabase
      .channel(`live-radar-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;

          if (row.status === "cancelled" || row.status === "recovering") {
            setOpenSlot(row);
            setState("race");
            toast.info("🚨 SLOT OPEN: Tap to claim!");
          } else if (row.status === "recovered" || row.status === "confirmed") {
            if (openSlot?.id === row.id && state === "race") {
              setState("radar");
              setOpenSlot(null);
            }
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    // 1.5s active continuous fallback polling
    const pollInterval = setInterval(checkOpenSlots, 1500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [state, openSlot]);

  // ══════════════════════════════════════════════════════════════════
  // STATE C -> D: Execute Atomic Lock Slot Claim
  // ══════════════════════════════════════════════════════════════════
  const handleClaimSlot = async () => {
    if (!openSlot || isClaiming) return;
    setIsClaiming(true);
    setClaimErrorMessage("");

    try {
      const res = await fetch("/api/claim-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: openSlot.id,
          patient_name: patientName || "Alex Morgan",
          patient_phone: patientPhone || "+1 (555) 019-2834",
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setState("secured");
        toast.success("🎉 Slot Secured! Your appointment is locked.");
      } else {
        setClaimErrorMessage(
          json.error || "Slot contention: Another patient claimed this slot milliseconds faster."
        );
        setState("lost");
      }
    } catch (err: any) {
      setClaimErrorMessage(err.message || "Failed to secure slot lock.");
      setState("lost");
    } finally {
      setIsClaiming(false);
    }
  };

  const handleResetSession = () => {
    try {
      localStorage.removeItem("fillwell_buzzer_patient");
    } catch {}
    setOpenSlot(null);
    setState("onboarding");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-stone-50 text-stone-900 font-sans selection:bg-rose-200">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-30 flex w-full max-w-lg items-center justify-between border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm shadow-rose-200">
            <HeartPulse className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight text-stone-900 leading-tight">Fillwell Mobile</h1>
            <p className="text-[10px] font-medium text-stone-500 leading-tight">AI Triage & Digital Buzzer</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Settings button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-center h-7 w-7 rounded-full border border-stone-200 bg-stone-50 text-stone-600 hover:text-rose-600 hover:bg-rose-50 transition shadow-sm"
            title="Configure Date/Time Simulation & Capacity"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          {/* Behind the scenes toggle button */}
          <button
            onClick={() => setShowInspector(!showInspector)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold transition border ${
              showInspector
                ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
            }`}
            title="Toggle Behind-the-Scenes JSON & Calendar Telemetry"
          >
            <Terminal className="h-3 w-3" />
            <span>Behind Scenes</span>
            {showInspector ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          <div className="flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[9px] font-mono font-bold text-stone-600">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            {connected ? "LIVE" : "POLLING"}
          </div>
        </div>
      </header>

      {/* ── BEHIND THE SCENES INSPECTOR DRAWER (Collapsible) ── */}
      {showInspector && (
        <div className="w-full max-w-lg bg-stone-900 text-white p-4 border-b border-purple-500/30 shadow-2xl animate-page-in">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-purple-400 animate-ping" />
              <span className="text-xs font-mono font-bold text-purple-300">
                Gemini & Calendar Pipeline Telemetry
              </span>
            </div>
            <div className="flex gap-1">
              {[
                { id: "gemini_json", label: "Gemini JSON", icon: FileJson },
                { id: "calendar_context", label: "Calendar Ctx", icon: Calendar },
                { id: "prompt_input", label: "Prompt Input", icon: Code },
                { id: "db_sync", label: "DB Payload", icon: Database },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setInspectorTab(tab.id as any)}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-semibold transition ${
                    inspectorTab === tab.id
                      ? "bg-purple-600 text-white shadow"
                      : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="font-mono text-[11px] bg-stone-950 p-3 rounded-xl border border-stone-800 max-h-52 overflow-y-auto text-emerald-400">
            {inspectorTab === "gemini_json" && (
              <pre className="whitespace-pre-wrap">
                {lastGeminiOutput
                  ? JSON.stringify(lastGeminiOutput, null, 2)
                  : "// Send an AI message or test chip to inspect the structured Gemini JSON output."}
              </pre>
            )}

            {inspectorTab === "calendar_context" && (
              <pre className="whitespace-pre-wrap text-amber-300">
                {calendarContext
                  ? JSON.stringify(calendarContext, null, 2)
                  : JSON.stringify(
                      {
                        current_date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
                        current_time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        is_clinic_open_now: new Date().getHours() >= 8 && new Date().getHours() < 17,
                        timezone: "America/New_York (EST)",
                        operating_hours: "Monday - Friday: 08:00 AM - 05:00 PM EST (24/7 Standby Radar)",
                      },
                      null,
                      2
                    )}
              </pre>
            )}

            {inspectorTab === "prompt_input" && (
              <pre className="whitespace-pre-wrap text-cyan-300">
                {lastGeminiPrompt
                  ? lastGeminiPrompt
                  : "// Raw prompt payload dispatched to /api/gemini/triage will render here."}
              </pre>
            )}

            {inspectorTab === "db_sync" && (
              <pre className="whitespace-pre-wrap text-purple-300">
                {lastDbPayload
                  ? JSON.stringify(lastDbPayload, null, 2)
                  : JSON.stringify(
                      {
                        target_table: "waitlist_entries",
                        patient_name: patientName || "Alex Morgan",
                        urgency_tier: urgencyTier,
                        priority_score: priorityScore,
                        is_complete_triage: isCompleteTriage,
                        status: "waiting",
                        realtime_channel: "live-radar",
                      },
                      null,
                      2
                    )}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* ── Main Container ── */}
      <main className="flex w-full max-w-lg flex-1 flex-col justify-between p-4">
        {/* ══════════════════════════════════════════════════════════════════
            STATE A: ONBOARDING (AI CHAT TRIAGE OR DIRECT FORM)
        ══════════════════════════════════════════════════════════════════ */}
        {state === "onboarding" && (
          <div className="flex flex-1 flex-col justify-between space-y-4 animate-page-in">
            {/* Mode Switcher */}
            <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-stone-200 shadow-sm">
              <div className="grid grid-cols-2 gap-1 w-full">
                <button
                  type="button"
                  onClick={() => setInputMode("ai_chat")}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition ${
                    inputMode === "ai_chat"
                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Clinical Chatbot</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInputMode("form")}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition ${
                    inputMode === "form"
                      ? "bg-stone-900 text-white shadow-md"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Direct Form</span>
                </button>
              </div>
            </div>

            {/* TAB 1: AI CHAT TRIAGE INTERFACE WITH CALENDAR CONTEXT & CONVERSATIONAL GUIDANCE */}
            {inputMode === "ai_chat" && (
              <div className="flex flex-1 flex-col justify-between space-y-3">
                {/* Chat Messages Stream */}
                <div className="flex-1 space-y-3 max-h-[380px] overflow-y-auto pr-1 py-1">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[90%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                          msg.sender === "user"
                            ? "bg-rose-600 text-white rounded-br-none"
                            : "bg-white text-stone-800 border border-stone-200 rounded-bl-none"
                        }`}
                      >
                        <p className="font-medium whitespace-pre-wrap">{msg.text}</p>

                        {/* Triaged Clinical Metadata Pill */}
                        {msg.triageData && (
                          <div className="mt-2.5 pt-2 border-t border-stone-100 rounded-lg bg-stone-50 p-2 text-[10px] space-y-1">
                            <div className="flex justify-between items-center text-stone-700">
                              <span className={`font-bold uppercase ${
                                msg.triageData.is_complete_triage ? "text-rose-600" : "text-amber-600"
                              }`}>
                                {msg.triageData.is_complete_triage ? "✓ Complete Triage" : "⚠️ Clarifying Info"} · {msg.triageData.urgency_tier?.toUpperCase()} Priority ({msg.triageData.priority_score}/5)
                              </span>
                              <span className="font-mono text-stone-500">{msg.triageData.service_type}</span>
                            </div>

                            {msg.triageData.extracted_symptoms?.length > 0 && (
                              <p className="text-stone-500 truncate">
                                <strong>Symptoms:</strong> {msg.triageData.extracted_symptoms.join(", ")}
                              </p>
                            )}

                            {msg.triageData.missing_information?.length > 0 && (
                              <p className="text-amber-700 font-mono text-[9px]">
                                <strong>Needs:</strong> {msg.triageData.missing_information.join(", ")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="mt-1 px-1 text-[9px] font-mono text-stone-400">
                        {msg.timestamp}
                      </span>
                    </div>
                  ))}

                  {isSubmitting && (
                    <div className="flex items-center gap-2 text-xs text-stone-500 pl-2 animate-pulse">
                      <BrainCircuit className="h-4 w-4 text-rose-500 animate-spin" />
                      <span>Gemini AI is analyzing symptoms with calendar context…</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Progressive Suggestions / Next Steps */}
                {suggestedSteps.length > 0 && !isCompleteTriage && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-2 text-[10px] space-y-1">
                    <p className="font-bold text-amber-800 flex items-center gap-1">
                      <HelpCircle className="h-3 w-3 text-amber-600" /> Suggested Answers:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {suggestedSteps.map((step, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendChatMessage(`I have ${step}, my name is Alex Morgan`)}
                          className="rounded-lg bg-white border border-amber-200 px-2 py-0.5 font-medium text-amber-900 hover:bg-amber-100 transition text-[10px]"
                        >
                          "{step}"
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Clinical Test Chips */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-1">
                    Quick Clinical Test Chips
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SUGGESTED_PROMPTS.map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSendChatMessage(p.text)}
                        disabled={isSubmitting}
                        className="truncate rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-left text-[10px] font-semibold text-stone-700 shadow-sm transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat Input Field */}
                <div className="relative flex items-center pt-1.5">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                    placeholder="Describe symptoms, ask questions, or inquire about open days…"
                    disabled={isSubmitting}
                    className="w-full rounded-full border border-stone-200 bg-white py-3 pl-4 pr-12 text-xs text-stone-900 shadow-md outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendChatMessage()}
                    disabled={!chatInput.trim() || isSubmitting}
                    className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-30"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {/* Direct Enter Radar Action */}
                <button
                  type="button"
                  onClick={() => handleJoinStandby()}
                  disabled={isSubmitting}
                  className={`w-full rounded-2xl py-3 text-xs font-bold text-white shadow-lg transition flex items-center justify-center gap-1.5 mt-1 ${
                    isCompleteTriage
                      ? "bg-gradient-to-r from-rose-600 to-amber-600 shadow-rose-600/25 hover:scale-[1.01]"
                      : "bg-stone-900 hover:bg-stone-800"
                  }`}
                >
                  <Radio className="h-4 w-4" />
                  <span>
                    {isCompleteTriage
                      ? `✓ Activate Standby Radar for ${patientName || "Alex Morgan"} (${urgencyTier.toUpperCase()} Priority) →`
                      : `Enter Standby Radar for ${patientName || "Alex Morgan"} →`}
                  </span>
                </button>
              </div>
            )}

            {/* TAB 2: DIRECT FORM MODE */}
            {inputMode === "form" && (
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xl space-y-4">
                <form onSubmit={handleJoinStandby} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      Your Full Name
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" />
                      <input
                        required
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. Alex Morgan"
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-3 text-xs text-stone-900 outline-none transition focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" />
                      <input
                        required
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-3 text-xs font-mono text-stone-900 outline-none transition focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      Urgency Acuity
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "urgent", label: "🚨 Urgent", score: 5 },
                        { id: "moderate", label: "⚡ Moderate", score: 3 },
                        { id: "routine", label: "🗓️ Routine", score: 1 },
                      ].map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setUrgencyTier(u.id as any);
                            setPriorityScore(u.score);
                          }}
                          className={`p-2.5 rounded-xl border text-center transition ${
                            urgencyTier === u.id
                              ? "bg-rose-50 border-rose-500 ring-1 ring-rose-500"
                              : "bg-white border-stone-200 hover:border-stone-300"
                          }`}
                        >
                          <p className="text-[11px] font-bold text-stone-900">{u.label}</p>
                          <p className="text-[9px] text-stone-400">Score {u.score}/5</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-2xl bg-rose-600 py-3.5 px-4 text-xs font-bold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-500 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Entering Radar…
                      </>
                    ) : (
                      <>
                        <Radio className="h-4 w-4" /> Activate Live Digital Buzzer &rarr;
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STATE B: THE RADAR (WAITING FOR OPENING)
        ══════════════════════════════════════════════════════════════════ */}
        {state === "radar" && (
          <div className="w-full flex flex-col items-center justify-center text-center space-y-6 animate-page-in py-4">
            {/* Status Pill */}
            <div className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-xs font-bold text-stone-700 shadow-sm flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <span>Standby Active for <strong>{patientName || "Alex Morgan"}</strong> ({urgencyTier.toUpperCase()} Priority)</span>
            </div>

            {/* Radar Animation */}
            <div className="relative flex h-52 w-52 items-center justify-center my-4">
              <div className="absolute inset-0 animate-ping rounded-full bg-rose-500/10 duration-1000" />
              <div className="absolute inset-4 animate-pulse rounded-full bg-rose-500/15" />
              <div className="absolute inset-10 animate-ping rounded-full bg-rose-500/20" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-rose-600 to-amber-600 text-white shadow-2xl shadow-rose-500/40">
                <Radio className="h-10 w-10 animate-bounce" />
              </div>
            </div>

            {/* Explainer */}
            <div className="space-y-2 max-w-xs">
              <h2 className="text-2xl font-black tracking-tight text-stone-900">
                Waiting for an opening...
              </h2>
              <p className="text-xs font-medium text-stone-500 leading-relaxed">
                Keep this screen open. When an appointment is cancelled by the clinic operator, this screen will turn bright red to claim.
              </p>
            </div>

            {/* Reset Button */}
            <button
              onClick={handleResetSession}
              className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-[11px] font-semibold text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition shadow-sm"
            >
              ← Edit Details or Leave Radar
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STATE C: THE RACE (BRIGHT RED - CLAIM SLOT NOW)
        ══════════════════════════════════════════════════════════════════ */}
        {state === "race" && (
          <div className="w-full rounded-3xl border-2 border-red-500 bg-gradient-to-b from-red-500 to-rose-600 p-6 sm:p-8 shadow-2xl text-white text-center space-y-6 animate-page-in">
            <div className="inline-flex animate-bounce items-center gap-1.5 rounded-full bg-white/20 px-4 py-1 text-xs font-black uppercase tracking-wider backdrop-blur-md">
              <Zap className="h-4 w-4 fill-current text-amber-300" /> IMMEDIATE OPENING DETECTED!
            </div>

            <div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-none text-white">
                SLOT OPEN!
              </h2>
              <p className="mt-2 text-xs font-medium text-red-100">
                A cancellation just occurred. Claim instantly to secure it.
              </p>
            </div>

            {/* Slot Details Card */}
            <div className="rounded-2xl bg-white/10 p-4 text-left text-xs space-y-2 border border-white/20 backdrop-blur-md">
              <div className="flex justify-between items-center text-red-100">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Service</span>
                <span className="font-bold text-white text-sm">
                  {openSlot?.service_type || "Clinical Consultation"}
                </span>
              </div>
              <div className="flex justify-between items-center text-red-100 border-t border-white/10 pt-2">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Time Slot</span>
                <span className="font-mono font-black text-white text-base">
                  {new Date(openSlot?.start_time || Date.now()).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  Today
                </span>
              </div>
            </div>

            {/* Massive Claim Button */}
            <button
              onClick={handleClaimSlot}
              disabled={isClaiming}
              className="w-full min-h-[64px] rounded-2xl bg-white py-4 px-6 text-xl sm:text-2xl font-black text-rose-600 shadow-2xl transition-all hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="h-7 w-7 animate-spin text-rose-600" />
                  <span>LOCKING SLOT…</span>
                </>
              ) : (
                <>
                  <Zap className="h-7 w-7 fill-current animate-pulse text-amber-500" />
                  <span>CLAIM SLOT NOW</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STATE D: RESOLUTION (WIN - GREEN SCREEN)
        ══════════════════════════════════════════════════════════════════ */}
        {state === "secured" && (
          <div className="w-full rounded-3xl border-2 border-emerald-400 bg-white p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-page-in">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
              <CheckCircle2 className="h-12 w-12" />
            </div>

            <div className="space-y-1">
              <h2 className="text-3xl font-black tracking-tight text-stone-900">
                Slot Secured! 🎉
              </h2>
              <p className="text-xs font-medium text-stone-500">
                Appointment successfully locked and registered for <strong className="text-stone-900">{patientName || "Alex Morgan"}</strong>.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs space-y-1.5 text-emerald-900 text-left">
              <div className="flex justify-between"><span className="text-emerald-700">Clinic:</span><span className="font-bold">Metro Urgent Care</span></div>
              <div className="flex justify-between"><span className="text-emerald-700">Service:</span><span className="font-bold">{openSlot?.service_type || "Emergency Consultation"}</span></div>
              <div className="flex justify-between"><span className="text-emerald-700">Status:</span><span className="font-mono font-bold text-emerald-600 uppercase">Atomic Lock Confirmed</span></div>
            </div>

            <button
              onClick={() => setState("radar")}
              className="w-full rounded-2xl bg-stone-900 py-3.5 text-xs font-bold text-white transition hover:bg-stone-800 shadow-md"
            >
              Done / Return to Radar
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STATE D: RESOLUTION (LOSE - GRAY CONTENTION SCREEN)
        ══════════════════════════════════════════════════════════════════ */}
        {state === "lost" && (
          <div className="w-full rounded-3xl border-2 border-stone-300 bg-white p-6 sm:p-8 shadow-xl text-center space-y-6 animate-page-in">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-500 shadow-inner">
              <XCircle className="h-10 w-10" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black tracking-tight text-stone-900">
                Slot Taken
              </h2>
              <p className="text-xs font-medium text-stone-500">
                {claimErrorMessage || "Another patient locked this slot milliseconds faster. You are still first in line for the next opening."}
              </p>
            </div>

            <button
              onClick={() => setState("radar")}
              className="w-full rounded-2xl bg-rose-600 py-3.5 text-xs font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-500 flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Resume Standby Radar
            </button>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="w-full max-w-lg border-t border-stone-200 p-3 text-center text-[10px] font-medium text-stone-400 flex items-center justify-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        <span>HIPAA Compliant · Gemini AI Triage with Calendar Context · PostgreSQL Atomic Lock</span>
      </footer>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => {}}
      />
    </div>
  );
}
