"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar, Clock, User, Phone, Sparkles, CheckCircle2, ChevronRight,
  ShieldCheck, Building2, CalendarCheck, ListOrdered, Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function BookPage() {
  const [mode, setMode] = useState<"book" | "waitlist">("book");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<"routine" | "moderate" | "urgent">("routine");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/appointments");
        const json = await res.json();
        if (json.success && json.data) {
          const open = json.data.filter((a: any) => a.status === "cancelled" || a.status === "recovering" || a.status === "open");
          setSlots(open);
          if (open.length > 0) setSelectedSlot(open[0].id);
        }
      } catch { }
      setLoading(false);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) { toast.error("Name and phone are required."); return; }
    if (mode === "book" && !selectedSlot) { toast.error("Select a slot."); return; }
    setSubmitting(true);
    try {
      if (mode === "book" && selectedSlot) {
        const res = await fetch(`/api/appointments/${selectedSlot}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "confirmed", patient_name: name, patient_phone: phone, cancellation_reason: null }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Already claimed.");
        setSuccess({ type: "booked", apt: json.data, msg: "Appointment confirmed and locked!" });
        toast.success("🎉 Booked!");
      } else {
        const res = await fetch("/api/waitlist", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patient_name: name, patient_phone: phone, urgency_tier: urgency, notes: reason || "Self-registered via QR Portal", preferred_time_windows: ["mornings", "afternoons"], preferred_days: ["monday", "tuesday", "wednesday", "thursday", "friday"] }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Failed.");
        setSuccess({ type: "waitlist", msg: "Added to the priority waitlist! You'll get an alert when a slot opens." });
        toast.success("✅ Waitlisted!");
      }
    } catch (err: any) { toast.error(err.message); }
    setSubmitting(false);
  };

  const tabCls = (active: boolean) => `flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${active ? "bg-white text-stone-900 shadow-sm border border-stone-200" : "text-stone-500 hover:text-stone-700"}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-lg space-y-6 animate-page-in">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm"><Building2 className="h-3.5 w-3.5" />Fillwell · Self-Booking</span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-stone-900">Book an Appointment</h1>
          <p className="text-sm text-stone-500">Claim an open slot or join the automated priority waitlist.</p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm text-center space-y-5">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <h2 className="text-xl font-bold text-stone-900">{success.type === "booked" ? "Booking Confirmed!" : "You're on the List!"}</h2>
            <p className="text-sm text-stone-500">{success.msg}</p>
            {success.apt && (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-left text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-stone-500">Patient:</span><span className="font-semibold text-stone-900">{name}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Service:</span><span className="font-semibold text-emerald-600">{success.apt.service_type}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Time:</span><span className="font-semibold text-stone-900">{new Date(success.apt.start_time).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
              </div>
            )}
            <button onClick={() => { setSuccess(null); setName(""); setPhone(""); setReason(""); }}
              className="w-full rounded-lg bg-stone-100 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-200 transition">Book Another</button>
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1 border border-stone-200">
              <button type="button" onClick={() => setMode("book")} className={tabCls(mode === "book")}><CalendarCheck className="h-4 w-4" />Claim Slot</button>
              <button type="button" onClick={() => setMode("waitlist")} className={tabCls(mode === "waitlist")}><ListOrdered className="h-4 w-4" />Waitlist</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-700">Full Name</label>
                  <div className="relative"><User className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                    <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe"
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-700">Phone</label>
                  <div className="relative"><Phone className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                    <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000"
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pl-8 pr-3 text-sm font-mono outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
                  </div>
                </div>
              </div>

              {mode === "book" ? (
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs font-medium text-stone-700">
                    <span>Open Slots</span>
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-600">Realtime</span>
                  </label>
                  {loading ? <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-stone-100" />)}</div> :
                    slots.length ? (
                      <div className="max-h-44 space-y-2 overflow-y-auto">
                        {slots.map((s) => {
                          const sel = selectedSlot === s.id;
                          return (
                            <div key={s.id} onClick={() => setSelectedSlot(s.id)}
                              className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition shadow-sm ${sel ? "border-rose-400 bg-rose-50 ring-1 ring-rose-400" : "border-stone-200 bg-white hover:border-rose-300"}`}>
                              <div className="flex items-center gap-2.5">
                                <div className={`rounded-md p-1.5 ${sel ? "bg-rose-100 text-rose-700" : "bg-stone-100 text-stone-500"}`}><Clock className="h-4 w-4" /></div>
                                <div>
                                  <p className="text-xs font-bold text-stone-900">{new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {s.service_type}</p>
                                  <p className="text-[10px] text-stone-500">Dr. Sarah Lin</p>
                                </div>
                              </div>
                              <div className={`h-4 w-4 rounded-full border ${sel ? "border-rose-600 bg-rose-600" : "border-stone-300"} flex items-center justify-center`}>
                                {sel && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-center text-xs text-stone-500">
                        No open slots right now. <button type="button" onClick={() => setMode("waitlist")} className="font-bold text-rose-600">Join the waitlist →</button>
                      </div>
                    )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-700">Urgency Level</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([{ id: "urgent", label: "🚨 Urgent", sub: "Same-Day" }, { id: "moderate", label: "⚡ Moderate", sub: "This Week" }, { id: "routine", label: "🗓️ Routine", sub: "Next Avail" }] as const).map((u) => (
                        <button key={u.id} type="button" onClick={() => setUrgency(u.id)}
                          className={`rounded-lg border p-2.5 text-center transition shadow-sm ${urgency === u.id ? "border-rose-400 bg-rose-50 ring-1 ring-rose-400" : "border-stone-200 bg-white hover:border-rose-300"}`}>
                          <p className="text-[11px] font-bold text-stone-900">{u.label}</p>
                          <p className="text-[9px] text-stone-500">{u.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-700">Reason (optional)</label>
                    <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Severe headache"
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
                  </div>
                </div>
              )}

              <button type="submit" disabled={submitting || (mode === "book" && !slots.length)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60 disabled:cursor-not-allowed">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Processing…</> :
                  mode === "book" ? <><span>Confirm & Lock</span><ChevronRight className="h-4 w-4" /></> :
                  <><span>Join Waitlist</span><Sparkles className="h-4 w-4" /></>}
              </button>
            </form>

            <div className="flex items-center justify-center gap-1.5 border-t border-stone-100 pt-3 text-[11px] text-stone-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />HIPAA Compliant · Instant Confirmation
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
