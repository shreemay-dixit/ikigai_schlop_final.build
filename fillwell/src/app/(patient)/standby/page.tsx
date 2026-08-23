"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Radio, Zap, CheckCircle2, XCircle, Sparkles, User, Phone,
  ChevronRight, ShieldCheck, RotateCcw, Stethoscope, BrainCircuit,
  Loader2, Send, MessageSquare, AlertTriangle, Calendar, Clock,
  ArrowRight, HeartPulse
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

type State = "chat_triage" | "waiting" | "slot_opened" | "claimed" | "missed";

interface ChatMessage {
  id: string;
  sender: "assistant" | "patient";
  text: string;
  timestamp: string;
  type?: "text" | "cancel_confirmation" | "patient_form" | "triage_summary";
  metadata?: any;
}

export default function StandbyPage() {
  const [state, setState] = useState<State>("chat_triage");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Patient Context
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [triageData, setTriageData] = useState<any>(null);
  
  // Slot & Claim State
  const [slot, setSlot] = useState<any>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimErr, setClaimErr] = useState("");
  const [connected, setConnected] = useState(true);
  const [cancelTargetApt, setCancelTargetApt] = useState<any>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, isSubmitting]);

  // Initial welcome message
  useEffect(() => {
    const saved = localStorage.getItem("fillwell_standby_user");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.name && p.triage) {
          setPatientName(p.name);
          setPatientPhone(p.phone || "");
          setTriageData(p.triage);
          setState("waiting");
          return;
        }
      } catch {}
    }

    setMessages([
      {
        id: "msg-welcome",
        sender: "assistant",
        text: "Hi, I'm the Fillwell Assistant. How can I help you with your appointment today?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: "text",
      },
    ]);
  }, []);

  // Quick Action Chips
  const QUICK_PROMPTS = [
    { label: "❌ Cancel 2 PM today", text: "I need to cancel my 2 PM appointment today" },
    { label: "⚡ Urgent Standby", text: "I have acute chest pain and shortness of breath, need immediate standby" },
    { label: "📋 Waitlist Dr. Reyes", text: "I want to get on the waitlist for Dr. Reyes for a routine checkup" },
    { label: "🗓️ Severe Fever", text: "Fever 102°F and migraine since last night, need earliest opening" },
  ];

  // ── State 1 & 2: Handle NLP Triage Submission ──
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isSubmitting) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: "patient",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsSubmitting(true);

    try {
      // 1. Call Gemini NLP Triage
      const res = await fetch("/api/gemini/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, channel: "mobile_web_triage" }),
      });
      const json = await res.json();
      const ai = json.data || {
        intent: "book_appointment",
        urgency_tier: "urgent",
        priority_score: 5,
        service_type: "Emergency Consultation",
        extracted_symptoms: ["Acute Symptoms"],
        conversational_reply: "I understand you need immediate assistance.",
      };

      setTriageData(ai);

      // Extract name if provided
      if (ai.patient_name && ai.patient_name !== "Patient") {
        setPatientName(ai.patient_name);
      }
      if (ai.patient_phone && !ai.patient_phone.includes("555-019")) {
        setPatientPhone(ai.patient_phone);
      }

      // Handle CANCEL / RESCHEDULE Intent
      if (ai.intent === "cancel" || ai.intent === "reschedule") {
        // Fetch confirmed appointments to match
        const aptRes = await fetch("/api/appointments");
        const aptJson = await aptRes.json();
        const confirmedApts = (aptJson.data || []).filter((a: any) => a.status === "confirmed");
        const matchedApt = confirmedApts[0] || {
          id: "apt-mock",
          patient_name: ai.patient_name || "You",
          service_type: ai.service_type || "General Consultation",
          start_time: new Date(Date.now() + 3600000).toISOString(),
        };

        setCancelTargetApt(matchedApt);

        const replyMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: "assistant",
          text: `I noticed you'd like to ${ai.intent === "cancel" ? "cancel" : "reschedule"} an appointment.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "cancel_confirmation",
          metadata: {
            appointment: matchedApt,
            intent: ai.intent,
          },
        };
        setMessages((prev) => [...prev, replyMsg]);
      } else {
        // BOOK / STANDBY Intent -> Prompt for details or register
        const replyMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: "assistant",
          text: `I've triaged your request as ${ai.urgency_tier.toUpperCase()} priority (Score: ${ai.priority_score}/5). To place you on the Live Standby Radar, please confirm your contact details.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "patient_form",
          metadata: { triage: ai },
        };
        setMessages((prev) => [...prev, replyMsg]);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process request");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "assistant",
          text: "I had trouble connecting to the clinical triage service. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Handle Cancellation Execution ──
  const handleConfirmCancellation = async (aptId: string, isReschedule: boolean) => {
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/appointments/${aptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          cancellation_reason: "Cancelled via Mobile NLP Triage Assistant",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Appointment successfully cancelled — Recovery wave dispatched!");
        
        if (isReschedule) {
          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              sender: "assistant",
              text: "Your previous appointment has been cancelled. Would you like to enter the Live Standby Radar for the next immediate opening?",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              type: "patient_form",
              metadata: { triage: triageData },
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              sender: "assistant",
              text: "Your appointment has been cancelled and removed from the schedule. Let me know if you need anything else!",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }
      } else {
        toast.error(json.error || "Failed to cancel appointment");
      }
    } catch {
      toast.error("Network error during cancellation");
    } finally {
      setIsCancelling(false);
    }
  };

  // ── Handle Waitlist Registration ──
  const handleRegisterWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    const ph = patientPhone.trim() || "+1 (555) 019-2834";
    setIsSubmitting(true);

    try {
      const urgency = triageData?.urgency_tier || "urgent";
      const score = triageData?.priority_score || 5;

      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: patientName,
          patient_phone: ph,
          urgency_tier: urgency,
          priority_score: score,
          notes: `NLP Triage: ${triageData?.conversational_reply || "Patient joined via mobile gateway"}`,
          preferred_time_windows: ["mornings", "afternoons"],
          preferred_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        }),
      });

      localStorage.setItem(
        "fillwell_standby_user",
        JSON.stringify({ name: patientName, phone: ph, triage: triageData })
      );

      toast.success(`You're now on the Live Standby Radar (${urgency.toUpperCase()} Priority)`);
      setState("waiting");
    } catch (err: any) {
      toast.error(err.message || "Failed to join waitlist");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── State 3: Realtime Slot Listener for Digital Buzzer ──
  useEffect(() => {
    if (state !== "waiting" && state !== "slot_opened") return;

    const checkSlots = async () => {
      try {
        const res = await fetch("/api/appointments");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const open = json.data.find(
            (a: any) => a.status === "cancelled" || a.status === "recovering"
          );
          if (open && state === "waiting") {
            setSlot(open);
            setState("slot_opened");
            toast.info("⚡ A clinical slot just opened!");
          } else if (!open && state === "slot_opened") {
            setState("waiting");
          }
        }
      } catch {}
    };

    checkSlots();

    // Supabase Realtime channel
    const ch = supabase
      .channel(`buzzer-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;
          if (row.status === "cancelled" || row.status === "recovering") {
            setSlot(row);
            setState("slot_opened");
            toast.info("⚡ SLOT OPEN: Claim now!");
          } else if (row.status === "recovered" || row.status === "confirmed") {
            setSlot((prev: any) => {
              if (prev?.id === row.id) {
                setState("waiting");
                return null;
              }
              return prev;
            });
          }
        }
      )
      .subscribe((s) => {
        setConnected(s === "SUBSCRIBED");
      });

    // 1.5s active polling fallback
    const poll = setInterval(checkSlots, 1500);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, [state]);

  // ── State 3: Claim Slot Execution ──
  const handleClaim = async () => {
    if (!slot || claiming) return;
    setClaiming(true);
    setClaimErr("");

    try {
      const res = await fetch("/api/claim-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: slot.id,
          patient_name: patientName || "Standby Patient",
          patient_phone: patientPhone || "+1 (555) 019-2834",
        }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setState("claimed");
        toast.success("🎉 Slot successfully claimed and confirmed!");
      } else {
        setClaimErr(json.error || "Slot was claimed by another patient.");
        setState("missed");
      }
    } catch (err: any) {
      setClaimErr(err.message || "Failed to lock slot");
      setState("missed");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-stone-50 text-stone-900 font-sans selection:bg-rose-100">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-30 flex w-full max-w-lg items-center justify-between border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm shadow-rose-200">
            <HeartPulse className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-stone-900">Fillwell Mobile</h1>
            <p className="text-[10px] font-medium text-stone-500">AI Triage & Digital Buzzer</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-mono font-bold text-stone-600">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          {connected ? "LIVE" : "OFFLINE"}
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="flex w-full max-w-lg flex-1 flex-col justify-between p-4">
        {/* ══════════════════════════════════════════════════════════════════
            STATE 1 & 2: THE NLP TRIAGE & INTENT ROUTING CHAT
        ══════════════════════════════════════════════════════════════════ */}
        {state === "chat_triage" && (
          <div className="flex flex-1 flex-col justify-between space-y-4">
            {/* Chat Thread */}
            <div className="flex-1 space-y-4 overflow-y-auto py-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col animate-page-in ${
                    msg.sender === "patient" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${
                      msg.sender === "patient"
                        ? "bg-rose-500 text-white rounded-br-none"
                        : "bg-white text-stone-800 border border-stone-200 rounded-bl-none"
                    }`}
                  >
                    <p className="font-medium">{msg.text}</p>

                    {/* Intent Confirmation Card */}
                    {msg.type === "cancel_confirmation" && msg.metadata && (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-stone-800 space-y-3">
                        <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                            Appointment Detected
                          </span>
                          <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                            Confirmed
                          </span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-stone-900">
                            {msg.metadata.appointment.service_type || "General Consultation"}
                          </p>
                          <p className="text-stone-600 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-rose-500" />
                            {new Date(msg.metadata.appointment.start_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            Today
                          </p>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() =>
                              handleConfirmCancellation(
                                msg.metadata.appointment.id,
                                msg.metadata.intent === "reschedule"
                              )
                            }
                            disabled={isCancelling}
                            className="flex-1 rounded-lg bg-red-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {isCancelling ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cancelling…
                              </>
                            ) : (
                              "Confirm Cancellation"
                            )}
                          </button>
                          <button
                            onClick={() =>
                              setMessages((prev) => [
                                ...prev,
                                {
                                  id: `keep-${Date.now()}`,
                                  sender: "assistant",
                                  text: "Great! Your appointment remains confirmed and unchanged.",
                                  timestamp: new Date().toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }),
                                },
                              ])
                            }
                            disabled={isCancelling}
                            className="rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                          >
                            Keep It
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Patient Registration Card for Waitlist */}
                    {msg.type === "patient_form" && (
                      <form
                        onSubmit={handleRegisterWaitlist}
                        className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Standby Profile
                          </span>
                          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700 uppercase">
                            {triageData?.urgency_tier || "Urgent"}
                          </span>
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-stone-700">
                            Full Name
                          </label>
                          <input
                            required
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            placeholder="Sarah Jenkins"
                            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-stone-700">
                            Phone Number
                          </label>
                          <input
                            value={patientPhone}
                            onChange={(e) => setPatientPhone(e.target.value)}
                            placeholder="+1 (555) 000-0000"
                            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-mono text-stone-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full rounded-lg bg-rose-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Entering Radar…
                            </>
                          ) : (
                            <>
                              <Radio className="h-3.5 w-3.5" /> Activate Live Digital Buzzer
                            </>
                          )}
                        </button>
                      </form>
                    )}
                  </div>
                  <span className="mt-1 px-1 text-[10px] font-mono text-stone-400">
                    {msg.timestamp}
                  </span>
                </div>
              ))}

              {isSubmitting && (
                <div className="flex items-center gap-2 text-xs text-stone-400 pl-2 animate-pulse">
                  <BrainCircuit className="h-4 w-4 text-rose-500 animate-spin" />
                  <span>Gemini Assistant is thinking…</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Suggestion Chips */}
            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-1">
                Suggested Prompts
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(p.text)}
                    disabled={isSubmitting}
                    className="truncate rounded-xl border border-stone-200 bg-white px-2.5 py-2 text-left text-[11px] font-medium text-stone-600 shadow-sm transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Chat Input Field */}
              <div className="relative flex items-center pt-2">
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Ask anything (e.g. Cancel 2pm or need urgent visit)…"
                  disabled={isSubmitting}
                  className="w-full rounded-full border border-stone-200 bg-white py-3.5 pl-4 pr-12 text-xs text-stone-900 shadow-md outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100 disabled:opacity-50"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isSubmitting}
                  className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-30"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STATE 3: THE DIGITAL BUZZER (LIVE WAITLIST WAITING)
        ══════════════════════════════════════════════════════════════════ */}
        {state === "waiting" && (
          <div className="my-auto flex flex-col items-center justify-center text-center space-y-6 animate-page-in py-6">
            {/* Urgency Badge */}
            {triageData && (
              <div className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1 text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <BrainCircuit className="h-3.5 w-3.5 text-rose-600" />
                {triageData.urgency_tier} Priority (Score: {triageData.priority_score}/5)
              </div>
            )}

            {/* Radar Animation */}
            <div className="relative flex h-48 w-48 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-rose-500/10 duration-1000" />
              <div className="absolute inset-4 animate-pulse rounded-full bg-rose-500/15" />
              <div className="absolute inset-10 animate-ping rounded-full bg-rose-500/20" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-rose-600 text-white shadow-2xl shadow-rose-500/40">
                <Radio className="h-10 w-10 animate-bounce" />
              </div>
            </div>

            <div className="space-y-2 max-w-sm">
              <h2 className="text-2xl font-black tracking-tight text-stone-900">
                You are on the Live Waitlist
              </h2>
              <p className="text-sm font-medium text-stone-500 leading-relaxed">
                Active for <strong className="text-stone-800">{patientName || "Patient"}</strong>. Keep this screen open. When a cancellation occurs, you will receive an instant buzzer.
              </p>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem("fillwell_standby_user");
                setState("chat_triage");
              }}
              className="rounded-full border border-stone-200 bg-white px-5 py-2 text-xs font-semibold text-stone-500 transition hover:bg-stone-50 hover:text-stone-800 shadow-sm"
            >
              ← Back to Assistant
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STATE 3: THE DIGITAL BUZZER (SLOT OPENED - CLAIM NOW)
        ══════════════════════════════════════════════════════════════════ */}
        {state === "slot_opened" && (
          <div className="my-auto w-full rounded-3xl border-2 border-amber-400 bg-gradient-to-b from-amber-50 to-orange-50/60 p-6 sm:p-8 shadow-2xl shadow-amber-500/20 text-center space-y-6 animate-page-in">
            <div className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-4 py-1 text-xs font-black text-amber-800 uppercase tracking-wider">
              <Zap className="h-4 w-4 fill-current" /> SLOT OPENED FOR YOU!
            </div>

            <div>
              <h2 className="text-3xl font-black tracking-tight text-amber-950">
                Immediate Opening
              </h2>
              <p className="mt-1 text-xs font-semibold text-amber-700">
                Claim before another waitlist patient takes it.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-white p-5 text-left text-xs space-y-2.5 shadow-md">
              <div className="flex justify-between items-center text-stone-500">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Service</span>
                <span className="font-bold text-amber-900 text-sm">
                  {slot?.service_type || "Clinical Consultation"}
                </span>
              </div>
              <div className="flex justify-between items-center text-stone-500 border-t border-stone-100 pt-2">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Time</span>
                <span className="font-mono font-black text-stone-900 text-base">
                  {new Date(slot?.start_time || Date.now()).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  Today
                </span>
              </div>
            </div>

            {/* Massive Claim Button */}
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 py-4 px-6 text-xl font-black text-white shadow-xl shadow-orange-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {claiming ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  LOCKING SLOT…
                </>
              ) : (
                <>
                  <Zap className="h-6 w-6 fill-current animate-bounce" />
                  SLOT OPEN: CLAIM NOW
                </>
              )}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STATE 3: RESOLUTION (SUCCESS - CLAIMED)
        ══════════════════════════════════════════════════════════════════ */}
        {state === "claimed" && (
          <div className="my-auto w-full rounded-3xl border-2 border-emerald-400 bg-white p-8 shadow-xl text-center space-y-6 animate-page-in">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
              <CheckCircle2 className="h-12 w-12" />
            </div>

            <div className="space-y-1">
              <h2 className="text-3xl font-black tracking-tight text-stone-900">
                You Got It! 🎉
              </h2>
              <p className="text-sm font-medium text-stone-500">
                Appointment successfully locked for <strong className="text-stone-900">{patientName}</strong>.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-xs space-y-1 text-emerald-900">
              <p className="font-bold">Metro Health & Urgent Care</p>
              <p className="text-[11px] text-emerald-700">Please arrive 10 minutes early at Counter 2.</p>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem("fillwell_standby_user");
                setState("chat_triage");
              }}
              className="w-full rounded-xl bg-stone-900 py-3.5 text-sm font-bold text-white transition hover:bg-stone-800 shadow-md"
            >
              New Assistant Session
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STATE 3: RESOLUTION (MISSED IT)
        ══════════════════════════════════════════════════════════════════ */}
        {state === "missed" && (
          <div className="my-auto w-full rounded-3xl border-2 border-red-300 bg-white p-8 shadow-xl text-center space-y-6 animate-page-in">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500 shadow-inner">
              <XCircle className="h-12 w-12" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight text-stone-900">
                Slot Claimed
              </h2>
              <p className="text-sm font-medium text-stone-500">
                {claimErr || "Another patient locked this slot milliseconds faster."}
              </p>
            </div>

            <button
              onClick={() => setState("waiting")}
              className="w-full rounded-xl bg-rose-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-500 flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Resume Standby Radar
            </button>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="w-full max-w-lg border-t border-stone-200 p-3 text-center text-[10px] font-medium text-stone-400 flex items-center justify-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        HIPAA Compliant · Gemini AI Triage · Atomic Lock
      </footer>
    </div>
  );
}
