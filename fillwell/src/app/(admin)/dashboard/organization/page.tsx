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

  const handleSave = async () => {
    if (saveStatus === "saving") return;
    setSaveStatus("saving");
    try {
      await fetch("/api/organization", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.clinicName }),
      });
      formRef.current = form;
      setSaveStatus("saved");
      toast.success("Organization profile saved successfully!");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      toast.error("Failed to save organization");
      setSaveStatus("idle");
    }
  };

  const inputCls = "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100";

  const TABS = [
    { id: "profile", label: "General Profile", icon: Building2 },
    { id: "billing", label: "Billing", icon: CreditCard },
  ];

  if (loading) return <div className="p-8"><div className="h-8 w-48 animate-pulse rounded bg-stone-100" /></div>;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Organization</h1>
          <p className="text-sm text-stone-500">Manage your clinic profile and billing.</p>
        </div>
        <div className="flex items-center justify-end min-w-[100px]">
          <button
            onClick={handleSave}
            disabled={saveStatus === "saving" || JSON.stringify(form) === JSON.stringify(formRef.current)}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saveStatus === "saving" ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> :
             saveStatus === "saved" ? <><CheckCircle2 className="h-4 w-4" /> Saved</> :
             "Save"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Vertical Tabs */}
        <div className="w-full md:w-52 shrink-0 space-y-0.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                tab === t.id ? "bg-rose-50 text-rose-700" : "text-stone-600 hover:bg-stone-100"
              }`}>
              <t.icon className={`h-4 w-4 ${tab === t.id ? "text-rose-600" : "text-stone-400"}`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden min-h-[400px]">
          {tab === "profile" && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="max-w-md space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Clinic Name</label>
                  <input value={form.clinicName} onChange={(e) => setForm({ ...form, clinicName: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Timezone</label>
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
              <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 p-5">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Enterprise Plan</h3>
                  <p className="text-xs text-stone-500 mt-0.5">Unlimited providers and recovery waves.</p>
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
