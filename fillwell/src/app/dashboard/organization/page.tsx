"use client";

import React, { useState, useEffect, useRef } from "react";
import { Building2, CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function OrganizationPage() {
  const [tab, setTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  
  const [form, setForm] = useState({ clinicName: "", timezone: "America/New_York" });
  const formRef = useRef(form);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/organization");
        const json = await res.json();
        const org = json.data || {};
        const loaded = { clinicName: org.name || "Fillwell Clinic", timezone: "America/New_York" };
        setForm(loaded);
        formRef.current = loaded;
      } catch { toast.error("Failed to load organization settings"); }
      setLoading(false);
    };
    load();
  }, []);

  // Autosave logic
  useEffect(() => {
    if (loading) return;
    if (JSON.stringify(form) === JSON.stringify(formRef.current)) return; // No change

    setSaveStatus("saving");
    const handler = setTimeout(async () => {
      try {
        await fetch("/api/organization", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.clinicName }),
        });
        formRef.current = form;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch { toast.error("Autosave failed"); setSaveStatus("idle"); }
    }, 800); // 800ms debounce

    return () => clearTimeout(handler);
  }, [form, loading]);

  const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  const TABS = [
    { id: "profile", label: "General Profile", icon: Building2 },
    { id: "billing", label: "Billing", icon: CreditCard },
  ];

  if (loading) return <div className="p-8"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Organization</h1>
          <p className="text-sm text-slate-500">Manage your clinic profile and billing.</p>
        </div>
        <div className="flex items-center justify-end min-w-[100px]">
          {saveStatus === "saving" && <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Autosaving…</span>}
          {saveStatus === "saved" && <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>}
        </div>
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
        <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[400px]">
          {tab === "profile" && (
            <div className="p-6 md:p-8 space-y-6">
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

          {tab === "billing" && (
            <div className="p-6 md:p-8 space-y-6">
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
    </div>
  );
}
