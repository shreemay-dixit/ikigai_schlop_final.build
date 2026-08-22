"use client";

import React, { useState, useEffect } from "react";
import { Building2, Settings2, CreditCard, Save, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [tab, setTab] = useState("general");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    clinicName: "", timezone: "America/New_York",
    wave_size: 3, wave_timeout_mins: 5, auto_recovery_enabled: true,
    quiet_hours_start: "21:00:00", quiet_hours_end: "08:00:00",
  });
  const [original, setOriginal] = useState(form);

  useEffect(() => {
    const load = async () => {
      try {
        const [orgRes, settRes] = await Promise.all([
          fetch("/api/organization").then((r) => r.json()),
          fetch("/api/settings").then((r) => r.json()),
        ]);
        const org = orgRes.data || {};
        const sett = settRes.data || {};
        const loaded = {
          clinicName: org.name || "Fillwell Clinic",
          timezone: "America/New_York",
          wave_size: sett.wave_size ?? 3,
          wave_timeout_mins: sett.wave_timeout_mins ?? 5,
          auto_recovery_enabled: sett.auto_recovery_enabled ?? true,
          quiet_hours_start: sett.quiet_hours_start || "21:00:00",
          quiet_hours_end: sett.quiet_hours_end || "08:00:00",
        };
        setForm(loaded);
        setOriginal(loaded);
      } catch { toast.error("Failed to load settings"); }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => { setDirty(JSON.stringify(form) !== JSON.stringify(original)); }, [form, original]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save organization name
      await fetch("/api/organization", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.clinicName }),
      });
      // Save clinic settings
      const res = await fetch("/api/settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wave_size: form.wave_size,
          wave_timeout_mins: form.wave_timeout_mins,
          auto_recovery_enabled: form.auto_recovery_enabled,
          quiet_hours_start: form.quiet_hours_start,
          quiet_hours_end: form.quiet_hours_end,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setOriginal(form); setDirty(false);
        toast.success("Settings saved successfully");
      } else toast.error(json.error || "Save failed");
    } catch { toast.error("Network error saving settings"); }
    setSaving(false);
  };

  const handleRevert = () => { setForm(original); setDirty(false); };

  const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  const TABS = [
    { id: "general", label: "General", icon: Building2 },
    { id: "dispatch", label: "Wave Dispatch", icon: Settings2 },
    { id: "billing", label: "Billing", icon: CreditCard },
  ];

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
        <div className="flex gap-8">
          <div className="w-52 space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />)}</div>
          <div className="flex-1 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage your clinic profile and automated dispatch configuration.</p>
      </div>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Vertical Tabs */}
        <div className="w-full md:w-52 shrink-0 space-y-0.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                tab === t.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
              }`}>
              <t.icon className={`h-4 w-4 ${tab === t.id ? "text-indigo-600" : "text-slate-400"}`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {tab === "general" && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-semibold text-slate-900">General Profile</h2>
                <p className="text-xs text-slate-500">Public-facing clinic information.</p>
              </div>
              <div className="max-w-md space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Clinic Name</label>
                  <input value={form.clinicName} onChange={(e) => setForm({ ...form, clinicName: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Timezone</label>
                  <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={inputCls}>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {tab === "dispatch" && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-semibold text-slate-900">Wave Dispatch Settings</h2>
                <p className="text-xs text-slate-500">Control how the automated recovery engine dispatches to waitlisted patients.</p>
              </div>

              <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-indigo-900">Auto-Recovery Engine</h3>
                    <p className="text-xs text-indigo-700">Automatically dispatch to waitlist when a cancellation occurs.</p>
                  </div>
                  <button onClick={() => setForm({ ...form, auto_recovery_enabled: !form.auto_recovery_enabled })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.auto_recovery_enabled ? "bg-indigo-600" : "bg-slate-200"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${form.auto_recovery_enabled ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Candidates per Wave</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1} max={10} value={form.wave_size}
                      onChange={(e) => setForm({ ...form, wave_size: parseInt(e.target.value) })} className="flex-1 accent-indigo-600" />
                    <span className="w-8 text-center text-sm font-bold text-slate-900">{form.wave_size}</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Wave Timeout (min)</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1} max={30} value={form.wave_timeout_mins}
                      onChange={(e) => setForm({ ...form, wave_timeout_mins: parseInt(e.target.value) })} className="flex-1 accent-indigo-600" />
                    <span className="w-8 text-center text-sm font-bold text-slate-900">{form.wave_timeout_mins}m</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Quiet Hours Start</label>
                  <input type="time" value={form.quiet_hours_start.slice(0, 5)}
                    onChange={(e) => setForm({ ...form, quiet_hours_start: e.target.value + ":00" })} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Quiet Hours End</label>
                  <input type="time" value={form.quiet_hours_end.slice(0, 5)}
                    onChange={(e) => setForm({ ...form, quiet_hours_end: e.target.value + ":00" })} className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {tab === "billing" && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-semibold text-slate-900">Billing & Plans</h2>
                <p className="text-xs text-slate-500">Subscription and payment management.</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Enterprise Plan</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Unlimited providers and recovery waves.</p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase text-emerald-700">Active</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dirty State Banner */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-slate-200 bg-white/90 backdrop-blur-md px-6 py-3 shadow-[0_-2px_12px_-4px_rgba(0,0,0,0.08)] transition-transform duration-300 md:left-60 ${dirty ? "translate-y-0" : "translate-y-full"}`}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          <span className="text-sm font-medium text-slate-700">Unsaved changes</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRevert} disabled={saving} className="rounded-lg px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50">Discard</button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
