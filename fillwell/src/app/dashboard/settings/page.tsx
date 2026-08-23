"use client";

import React, { useState, useEffect, useRef } from "react";
import { Settings2, Loader2, CheckCircle2, Zap } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  
  const [form, setForm] = useState({
    wave_size: 3, wave_timeout_mins: 5, auto_recovery_enabled: true,
    quiet_hours_start: "21:00:00", quiet_hours_end: "08:00:00",
  });
  const formRef = useRef(form);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        const sett = json.data || {};
        const loaded = {
          wave_size: sett.wave_size ?? 3,
          wave_timeout_mins: sett.wave_timeout_mins ?? 5,
          auto_recovery_enabled: sett.auto_recovery_enabled ?? true,
          quiet_hours_start: sett.quiet_hours_start || "21:00:00",
          quiet_hours_end: sett.quiet_hours_end || "08:00:00",
        };
        setForm(loaded);
        formRef.current = loaded;
      } catch { toast.error("Failed to load settings"); }
      setLoading(false);
    };
    load();
  }, []);

  // Autosave logic
  useEffect(() => {
    if (loading) return;
    if (JSON.stringify(form) === JSON.stringify(formRef.current)) return;

    setSaveStatus("saving");
    const handler = setTimeout(async () => {
      try {
        await fetch("/api/settings", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        formRef.current = form;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch { toast.error("Autosave failed"); setSaveStatus("idle"); }
    }, 800);

    return () => clearTimeout(handler);
  }, [form, loading]);

  const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  if (loading) return <div className="p-8"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customization & Engine Settings</h1>
          <p className="text-sm text-slate-500">Configure automated dispatch behavior.</p>
        </div>
        <div className="flex items-center justify-end min-w-[100px]">
          {saveStatus === "saving" && <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Autosaving…</span>}
          {saveStatus === "saved" && <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-8">
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-indigo-900"><Zap className="h-4 w-4" />Auto-Recovery Engine</h3>
              <p className="text-xs text-indigo-700 mt-1">Automatically dispatch to waitlist when a cancellation occurs.</p>
            </div>
            <button onClick={() => setForm({ ...form, auto_recovery_enabled: !form.auto_recovery_enabled })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.auto_recovery_enabled ? "bg-indigo-600" : "bg-slate-200"}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${form.auto_recovery_enabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 pt-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Candidates per Wave</label>
            <p className="text-[11px] text-slate-500 mb-3">Number of patients to notify at once.</p>
            <div className="flex items-center gap-4">
              <input type="range" min={1} max={10} value={form.wave_size}
                onChange={(e) => setForm({ ...form, wave_size: parseInt(e.target.value) })} className="flex-1 accent-indigo-600" />
              <span className="w-8 text-center text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded py-1">{form.wave_size}</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Wave Timeout (mins)</label>
            <p className="text-[11px] text-slate-500 mb-3">Time before moving to next priority tier.</p>
            <div className="flex items-center gap-4">
              <input type="range" min={1} max={30} value={form.wave_timeout_mins}
                onChange={(e) => setForm({ ...form, wave_timeout_mins: parseInt(e.target.value) })} className="flex-1 accent-indigo-600" />
              <span className="w-10 text-center text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded py-1">{form.wave_timeout_mins}m</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Quiet Hours</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Do not disturb start</label>
              <input type="time" value={form.quiet_hours_start.slice(0, 5)}
                onChange={(e) => setForm({ ...form, quiet_hours_start: e.target.value + ":00" })} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Do not disturb end</label>
              <input type="time" value={form.quiet_hours_end.slice(0, 5)}
                onChange={(e) => setForm({ ...form, quiet_hours_end: e.target.value + ":00" })} className={inputCls} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
