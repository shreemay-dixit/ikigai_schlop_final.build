"use client";

import React, { useEffect, useState } from "react";
import { Activity, Loader2, Pause, Play, UserPlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface RecEvent {
  id: string; appointment_id: string; wave_number: number; status: string;
  current_wave_candidates: number; is_paused: boolean; wave_started_at: string;
  expires_at: string; appointment?: any; offers?: any[];
}

export default function RecoveryPage() {
  const [events, setEvents] = useState<RecEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  // Force assign form state
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recovery/override");
      const json = await res.json();
      setEvents(json.data || []);
    } catch { toast.error("Failed to fetch recovery events"); }
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleOverride = async (eventId: string, action: string) => {
    setActionId(eventId);
    try {
      const res = await fetch("/api/recovery/override", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recovery_event_id: eventId, action }),
      });
      const json = await res.json();
      if (json.success) { toast.success(`Recovery ${action === "pause" ? "paused" : action === "resume" ? "resumed" : "cancelled"}`); fetchEvents(); }
      else toast.error(json.error || "Failed");
    } catch { toast.error("Network error"); }
    setActionId(null);
  };

  const handleForceAssign = async (eventId: string) => {
    if (!walkInName.trim()) { toast.error("Enter walk-in patient name"); return; }
    setActionId(eventId);
    try {
      const res = await fetch("/api/recovery/override", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recovery_event_id: eventId, action: "force_assign", walk_in_patient_name: walkInName, walk_in_patient_phone: walkInPhone || "+1 (555) 000-0000" }),
      });
      const json = await res.json();
      if (json.success) { toast.success(`Slot force-assigned to ${walkInName}`); setAssignTarget(null); setWalkInName(""); setWalkInPhone(""); fetchEvents(); }
      else toast.error(json.error || "Contention — slot already claimed");
    } catch { toast.error("Network error"); }
    setActionId(null);
  };

  const statusColor = (s: string) => {
    const m: Record<string, string> = {
      active: "bg-amber-50 text-amber-700 border-amber-200",
      pending: "bg-blue-50 text-blue-700 border-blue-200",
      paused: "bg-slate-100 text-slate-600 border-slate-200",
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      expired: "bg-red-50 text-red-600 border-red-200",
      force_assigned: "bg-indigo-50 text-indigo-700 border-indigo-200",
    };
    return m[s] || m.pending;
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900"><Activity className="h-6 w-6 text-indigo-600" />Recovery Waves</h1>
          <p className="text-sm text-slate-500">Operator override panel for automated slot recovery events.</p>
        </div>
        <button onClick={fetchEvents} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <Activity className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">No active recovery events.</p>
          <p className="text-xs text-slate-400 mt-1">Cancel an appointment from the Appointments page to trigger one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((ev) => (
            <div key={ev.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${statusColor(ev.status)}`}>
                      {ev.status}
                    </span>
                    <span className="text-xs font-mono text-slate-400">Wave #{ev.wave_number}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    Appointment: <span className="font-mono text-xs text-slate-500">{ev.appointment_id.slice(0, 12)}…</span>
                    {ev.appointment && <span className="ml-2 text-slate-600">({ev.appointment.patient_name} — {ev.appointment.service_type})</span>}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Started {new Date(ev.wave_started_at).toLocaleString()} · {ev.current_wave_candidates} candidates targeted
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {ev.status === "active" && (
                    <button onClick={() => handleOverride(ev.id, "pause")} disabled={actionId === ev.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
                      {actionId === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />} Pause
                    </button>
                  )}
                  {ev.status === "paused" && (
                    <button onClick={() => handleOverride(ev.id, "resume")} disabled={actionId === ev.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-100 disabled:opacity-50">
                      <Play className="h-3.5 w-3.5" /> Resume
                    </button>
                  )}
                  {(ev.status === "active" || ev.status === "paused") && (
                    <>
                      <button onClick={() => handleOverride(ev.id, "cancel")} disabled={actionId === ev.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-50">
                        Cancel Wave
                      </button>
                      <button onClick={() => setAssignTarget(assignTarget === ev.id ? null : ev.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-100">
                        <UserPlus className="h-3.5 w-3.5" /> Force Assign
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Force Assign Form */}
              {assignTarget === ev.id && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-700">Force assign this slot to a walk-in patient:</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={walkInName} onChange={(e) => setWalkInName(e.target.value)} placeholder="Patient name"
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    <input value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} placeholder="Phone (optional)"
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    <button onClick={() => handleForceAssign(ev.id)} disabled={actionId === ev.id}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50">
                      {actionId === ev.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
