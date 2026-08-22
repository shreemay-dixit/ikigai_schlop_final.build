"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  Sparkles,
  Sliders,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  PhoneCall,
  Clock,
  Briefcase,
  Utensils,
  Ticket,
  Laptop,
  Stethoscope,
  Landmark,
} from "lucide-react";
import { toast } from "sonner";

export default function SetupWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [orgName, setOrgName] = useState("Metro Health & Urgent Care");
  const [industry, setIndustry] = useState("Healthcare & Emergency Clinic");
  const [activeCounters, setActiveCounters] = useState(3);
  const [baseServiceTime, setBaseServiceTime] = useState(14);
  const [operatingStart, setOperatingStart] = useState("08:00");
  const [operatingEnd, setOperatingEnd] = useState("18:00");
  const [personaTone, setPersonaTone] = useState("Empathetic, Clinical & Prioritized");
  const [connectGCal, setConnectGCal] = useState(true);
  const [connectTwilio, setConnectTwilio] = useState(true);
  const [connectVapi, setConnectVapi] = useState(true);

  const industries = [
    { id: "Healthcare & Emergency Clinic", icon: Stethoscope, desc: "Triage urgency 1-5, medical follow-ups, ER overflow" },
    { id: "Commercial Banking & Loans", icon: Landmark, desc: "Account opening, commercial loan consultations, wealth advisory" },
    { id: "Food Shop, Cafe & Restaurant", icon: Utensils, desc: "Table seating reservations, party sizing, rush turnover" },
    { id: "Concert, Theatre & Event Ticketing", icon: Ticket, desc: "Box office queue, VIP pass dispatch, batch admissions" },
    { id: "Retail & Tech Support Desk", icon: Laptop, desc: "Device repair drop-offs, warranty verification, diagnostic triage" },
    { id: "Government & DMV Licensing", icon: Briefcase, desc: "Driver license renewals, ADA express, document submissions" },
  ];

  async function handleFinishSetup() {
    setLoading(true);
    try {
      const res = await fetch("/api/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgName,
          industry,
          active_counters: activeCounters,
          base_service_time_mins: baseServiceTime,
          operating_hours_start: operatingStart,
          operating_hours_end: operatingEnd,
          ai_persona_tone: personaTone,
          google_calendar_connected: connectGCal,
          twilio_connected: connectTwilio,
          vapi_connected: connectVapi,
        }),
      });

      if (!res.ok) throw new Error("Failed to save organization profile");
      toast.success("Organization initialized successfully!");
      router.push("/");
    } catch (e: any) {
      toast.error(e.message || "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      {/* Wizard Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-mono">
          <Sparkles className="h-3.5 w-3.5" />
          <span>ORGANIZATION CONFIGURATION WIZARD</span>
        </div>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight">
          Configure Your Operational Workspace
        </h1>
        <p className="text-xs text-slate-400">
          Step {step} of 4 &bull; Fine-tune the AI triage engine, calendar sync, and operational state.
        </p>
      </div>

      {/* Progress Steps Bar */}
      <div className="grid grid-cols-4 gap-2">
        {["1. Profile & Sector", "2. Operational State", "3. AI Voice Persona", "4. Google Calendar"].map(
          (title, idx) => (
            <div
              key={title}
              className={`h-1.5 rounded-full transition-all ${
                step >= idx + 1
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500"
                  : "bg-slate-800"
              }`}
            />
          )
        )}
      </div>

      {/* Step 1: Profile & Industry */}
      {step === 1 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5 shadow-2xl">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-400" />
            <span>Organization Name & Commercial Sector</span>
          </h3>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Organization / Clinic Name *
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Apex Commercial Bank or Golden Bistro"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Select Commercial Domain / Sector *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {industries.map((ind) => {
                const Icon = ind.icon;
                const isSelected = industry === ind.id;
                return (
                  <button
                    key={ind.id}
                    type="button"
                    onClick={() => setIndustry(ind.id)}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition ${
                      isSelected
                        ? "bg-indigo-600/15 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-600/10"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected
                          ? "bg-indigo-600/20 text-indigo-400"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">{ind.id}</div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{ind.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Operational State */}
      {step === 2 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5 shadow-2xl">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Sliders className="h-4 w-4 text-purple-400" />
            <span>Daily Operational Capacity & State</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Active Service Counters / Desks ($c$)
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={activeCounters}
                onChange={(e) => setActiveCounters(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-500">Staff desks serving customers simultaneously.</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Base Service Duration ($\mu^{-1}$ mins)
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={baseServiceTime}
                onChange={(e) => setBaseServiceTime(parseInt(e.target.value) || 10)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-500">Average time per customer consultation.</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Operating Hours Start
              </label>
              <input
                type="time"
                value={operatingStart}
                onChange={(e) => setOperatingStart(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Operating Hours End
              </label>
              <input
                type="time"
                value={operatingEnd}
                onChange={(e) => setOperatingEnd(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: AI Persona Tone */}
      {step === 3 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5 shadow-2xl">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span>AI Voice & SMS Agent Personality</span>
          </h3>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Conversational Tone & AI Prompt Persona
            </label>
            <textarea
              value={personaTone}
              onChange={(e) => setPersonaTone(e.target.value)}
              rows={3}
              placeholder="e.g. Empathetic, Clinical & Prioritized triage for urgent emergency center."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          <div className="rounded-xl bg-slate-950 p-4 border border-slate-800/80 space-y-2">
            <h4 className="text-xs font-bold text-cyan-300">Multilingual NLP Support:</h4>
            <p className="text-[11px] text-slate-400">
              The Gemini 3-tier parsing pipeline will automatically detect English, Spanish, Hindi, French, Japanese, and 40+ languages during voice and SMS intake.
            </p>
          </div>
        </div>
      )}

      {/* Step 4: Google Calendar & Carriers */}
      {step === 4 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5 shadow-2xl">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <span>Google Calendar & Carrier Telemetry</span>
          </h3>

          <div className="space-y-3">
            {/* Google Calendar */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-indigo-400" />
                <div>
                  <div className="text-xs font-bold text-slate-100">Google Calendar Synchronization</div>
                  <div className="text-[10px] text-slate-400">Real-time free/busy blocks & auto-booking slot sync</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={connectGCal}
                onChange={(e) => setConnectGCal(e.target.checked)}
                className="h-4 w-4 accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Twilio */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-3">
                <PhoneCall className="h-5 w-5 text-emerald-400" />
                <div>
                  <div className="text-xs font-bold text-slate-100">Twilio Voice & SMS Carrier</div>
                  <div className="text-[10px] text-slate-400">Inbound phone calls, SMS booking & TwiML replies</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={connectTwilio}
                onChange={(e) => setConnectTwilio(e.target.checked)}
                className="h-4 w-4 accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-2">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        ) : <div />}

        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 transition"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={handleFinishSetup}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:opacity-95 text-xs font-extrabold text-white shadow-xl shadow-purple-600/30 transition disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {loading ? "Launching Organization..." : "Launch Organization Workspace"}
          </button>
        )}
      </div>
    </div>
  );
}
