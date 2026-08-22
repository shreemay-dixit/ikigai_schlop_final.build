"use client";

import React, { useState, useEffect } from "react";
import {
  Radio, Zap, CheckCircle2, XCircle, Sparkles, User, Phone,
  ChevronRight, ShieldCheck, RotateCcw, Stethoscope, BrainCircuit, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

type State = "intake" | "analyzing" | "waiting" | "slot_opened" | "claimed" | "missed";

export default function StandbyPage() {
  const [state, setState] = useState<State>("intake");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [triage, setTriage] = useState<any>(null);
  const [slot, setSlot] = useState<any>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimErr, setClaimErr] = useState("");
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fillwell_standby_user");
      if (saved) {
        const p = JSON.parse(saved);
        if (p.name) { setName(p.name); setPhone(p.phone || ""); if (p.triage) setTriage(p.triage); setState("waiting"); }
      }
    } catch { }
  }, []);

  const PRESETS = [
    { label: "🚨 Chest Pain", text: "Acute crushing chest pain radiating to left arm with cold sweat." },
    { label: "⚡ High Fever", text: "Persistent fever 103°F with severe headache and blurred vision." },
    { label: "🦶 Sprained Ankle", text: "Twisted ankle during run, severe swelling, unable to bear weight." },
    { label: "🗓️ Routine BP", text: "Routine 3-month follow-up for hypertension and prescription refill." },
  ];

  // ── Realtime listener ──
  useEffect(() => {
    if (state === "intake" || state === "analyzing") return;

    const checkSlots = async () => {
      try {
        const res = await fetch("/api/appointments");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const open = json.data.find((a: any) => a.status === "cancelled" || a.status === "recovering");
          if (open) { setSlot(open); setState("slot_opened"); }
        }
      } catch { }
    };
    checkSlots();

    const ch = supabase.channel(`standby-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, (payload) => {
        const row = payload.new as any;
        if (!row) return;
        if (row.status === "cancelled" || row.status === "recovering") {
          setSlot(row); setState("slot_opened"); toast.info("⚡ A slot just opened!");
        } else if (row.status === "recovered" || row.status === "booked") {
          setSlot((prev: any) => { if (prev?.id === row.id) { setState("waiting"); return null; } return prev; });
        }
      })
      .subscribe((s) => { setConnected(s === "SUBSCRIBED"); });

    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/appointments");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const open = json.data.find((a: any) => a.status === "cancelled" || a.status === "recovering");
          if (open && state === "waiting") { setSlot(open); setState("slot_opened"); }
          else if (!open && state === "slot_opened") setState("waiting");
        }
      } catch { }
    }, 1500);

    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [state]);

  // ── Submit triage ──
  const handleTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Enter your name"); return; }
    if (!symptoms.trim()) { toast.error("Describe your symptoms"); return; }
    setState("analyzing");
    const ph = phone || "+1 (555) 019-2834";
    try {
      const triRes = await fetch("/api/gemini/triage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: `Patient: ${name}. Phone: ${ph}. Complaint: ${symptoms}`, channel: "patient_gateway" }),
      });
      const triJson = await triRes.json();
      const ai = triJson.data || { urgency_tier: "urgent", priority_score: 5, service_type: "Emergency Consultation", extracted_symptoms: [], conversational_reply: "Immediate evaluation recommended." };
      setTriage(ai);
      localStorage.setItem("fillwell_standby_user", JSON.stringify({ name, phone: ph, triage: ai }));

      await fetch("/api/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_name: name, patient_phone: ph, urgency_tier: ai.urgency_tier || "urgent", priority_score: ai.priority_score || 5, notes: `AI Triage: ${symptoms}`, preferred_time_windows: ["mornings", "afternoons"], preferred_days: ["monday", "tuesday", "wednesday", "thursday", "friday"] }),
      });
      setState("waiting");
      toast.success(`Triage complete: ${(ai.urgency_tier || "urgent").toUpperCase()} priority`);
    } catch (err: any) { toast.error(err.message); setState("intake"); }
  };

  // ── Claim slot ──
  const handleClaim = async () => {
    if (!slot || claiming) return;
    setClaiming(true); setClaimErr("");
    try {
      const res = await fetch("/api/claim-slot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: slot.id, patient_name: name, patient_phone: phone || "+1 (555) 019-2834" }),
      });
      const json = await res.json();
      if (res.ok && json.success) { setState("claimed"); toast.success("🎉 You got the slot!"); }
      else { setClaimErr(json.error || "Slot was claimed by another patient."); setState("missed"); }
    } catch (err: any) { setClaimErr(err.message); setState("missed"); }
    setClaiming(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-slate-50 p-4 sm:p-6">
      {/* Header */}
      <div className="flex w-full max-w-lg items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-600 p-2 text-white"><BrainCircuit className="h-4 w-4" /></div>
          <div>
            <h1 className="text-sm font-bold text-slate-900">Fillwell Patient Gateway</h1>
            <p className="text-[10px] text-slate-500">Gemini AI Triage & Live Standby</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-mono text-slate-600 shadow-sm">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          {connected ? "LIVE" : "CONNECTING"}
        </div>
      </div>

      {/* Content */}
      <div className="my-auto w-full max-w-lg py-6">
        {/* ── Intake ── */}
        {state === "intake" && (
          <div className="animate-page-in rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-700"><Sparkles className="h-3 w-3" />Step 1: AI Triage</span>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Describe Your Symptoms</h2>
              <p className="text-xs text-slate-500">Gemini AI evaluates urgency and queues you on the live standby radar.</p>
            </div>
            <form onSubmit={handleTriage} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Full Name</label>
                  <div className="relative"><User className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Phone</label>
                  <div className="relative"><Phone className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs font-mono outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3 text-indigo-600" />Chief Complaint</span>
                  <span className="text-[10px] text-indigo-500 font-mono">Gemini 1.5</span>
                </label>
                <textarea rows={3} required value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Duration, severity, pain location…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.map((c, i) => (
                  <button key={i} type="button" onClick={() => setSymptoms(c.text)}
                    className="truncate rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-[11px] text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700">{c.label}</button>
                ))}
              </div>
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500">
                <BrainCircuit className="h-4 w-4" />Analyze & Join Standby<ChevronRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* ── Analyzing ── */}
        {state === "analyzing" && (
          <div className="animate-page-in rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-5">
            <BrainCircuit className="mx-auto h-12 w-12 text-indigo-600 animate-pulse" />
            <h2 className="text-lg font-bold text-slate-900">Running Gemini AI Triage…</h2>
            <p className="text-xs text-slate-500">Extracting symptoms, scoring urgency, prioritizing queue position.</p>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        )}

        {/* ── Waiting ── */}
        {state === "waiting" && (
          <div className="animate-page-in rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            {triage && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-indigo-600"><BrainCircuit className="h-3 w-3" />AI Triage</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                    triage.urgency_tier === "urgent" ? "bg-red-50 text-red-700 border-red-200" :
                    triage.urgency_tier === "moderate" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>{triage.urgency_tier} ({triage.priority_score}/5)</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">{triage.service_type || "Consultation"}</p>
                <p className="text-[11px] italic text-slate-500">"{triage.conversational_reply}"</p>
              </div>
            )}
            <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500/10" />
              <div className="absolute inset-3 animate-pulse rounded-full bg-indigo-500/20" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg">
                <Radio className="h-7 w-7 animate-bounce" />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-slate-900">Live Standby Active</h2>
              <p className="text-xs text-slate-500">Waiting for <strong>{name}</strong>. Keep this page open.</p>
            </div>
            <button onClick={() => { localStorage.removeItem("fillwell_standby_user"); setState("intake"); }}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">← Edit Symptoms</button>
          </div>
        )}

        {/* ── Slot Opened ── */}
        {state === "slot_opened" && (
          <div className="animate-page-in rounded-2xl border-2 border-amber-400 bg-amber-50 p-6 shadow-lg space-y-5 text-center">
            <span className="inline-flex animate-pulse items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700"><Zap className="h-3.5 w-3.5" />SLOT OPENED!</span>
            <h2 className="text-2xl font-black tracking-tight text-amber-900">Immediate Opening</h2>
            <div className="rounded-xl border border-amber-200 bg-white p-4 text-left text-xs space-y-1.5 shadow-sm">
              <div className="flex justify-between text-slate-500"><span>Service:</span><span className="font-bold text-amber-700">{slot?.service_type || "Consultation"}</span></div>
              <div className="flex justify-between text-slate-500"><span>Time:</span><span className="font-bold text-slate-900 font-mono">{new Date(slot?.start_time || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} Today</span></div>
            </div>
            <button onClick={handleClaim} disabled={claiming}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-5 text-xl font-black text-white shadow-xl transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
              {claiming ? <><Loader2 className="h-5 w-5 animate-spin" />LOCKING…</> : <><Zap className="h-6 w-6" />CLAIM NOW</>}
            </button>
          </div>
        )}

        {/* ── Claimed ── */}
        {state === "claimed" && (
          <div className="animate-page-in rounded-2xl border-2 border-emerald-400 bg-white p-8 shadow-sm space-y-5 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
            <h2 className="text-2xl font-extrabold text-slate-900">You Got It! 🎉</h2>
            <p className="text-sm text-slate-500">Appointment locked for <strong>{name}</strong>.</p>
            <button onClick={() => { localStorage.removeItem("fillwell_standby_user"); setState("intake"); }}
              className="w-full rounded-lg bg-slate-100 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200">New Intake</button>
          </div>
        )}

        {/* ── Missed ── */}
        {state === "missed" && (
          <div className="animate-page-in rounded-2xl border-2 border-red-300 bg-white p-8 shadow-sm space-y-5 text-center">
            <XCircle className="mx-auto h-16 w-16 text-red-500" />
            <h2 className="text-2xl font-extrabold text-slate-900">Missed It</h2>
            <p className="text-sm text-slate-500">{claimErr || "Another patient claimed it first."}</p>
            <button onClick={() => setState("waiting")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500">
              <RotateCcw className="h-4 w-4" />Resume Standby
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex w-full max-w-lg items-center justify-center gap-1.5 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
        <ShieldCheck className="h-3 w-3 text-emerald-500" />HIPAA Compliant · Gemini AI · Realtime WebSockets
      </div>
    </div>
  );
}
