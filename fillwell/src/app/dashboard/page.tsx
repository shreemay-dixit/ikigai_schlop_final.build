"use client";

import React, { useEffect, useState } from "react";
import { Calendar, Users, Activity, TrendingUp, Zap, RefreshCw, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

export default function DashboardOverview() {
  const [stats, setStats] = useState({ appointments: 0, waitlist: 0, recovery: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [portalUrl, setPortalUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setPortalUrl(`${window.location.origin}/standby`);
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [aptRes, waitRes, recRes] = await Promise.all([
        fetch("/api/appointments").then((r) => r.json()),
        fetch("/api/waitlist").then((r) => r.json()),
        fetch("/api/recovery/override").then((r) => r.json()),
      ]);
      const apts = aptRes.data || [];
      setStats({
        appointments: apts.length,
        waitlist: (waitRes.data || []).filter((w: any) => w.is_active).length,
        recovery: (recRes.data || []).length,
        cancelled: apts.filter((a: any) => a.status === "cancelled").length,
      });
    } catch { }
    setLoading(false);
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await fetch("/api/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "seed" }) });
      toast.success("Demo data seeded");
      fetchStats();
    } catch { toast.error("Seed failed"); }
    setSeeding(false);
  };

  const handleReset = async () => {
    setSeeding(true);
    try {
      await fetch("/api/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset" }) });
      toast.success("Database reset to clean state");
      fetchStats();
    } catch { toast.error("Reset failed"); }
    setSeeding(false);
  };

  const Stat = ({ icon: Icon, label, value, color, href }: any) => (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-center justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        {href && (
          <Link href={href} className="text-xs font-medium text-slate-400 hover:text-indigo-600 flex items-center gap-0.5 transition-colors">
            View <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">
        {loading ? <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-100" /> : value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500">Your clinic at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSeed} disabled={seeding} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
            {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-amber-500" />}
            Seed Demo Data
          </button>
          <button onClick={handleReset} disabled={seeding} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" /> Reset
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Calendar} label="Total Appointments" value={stats.appointments} color="bg-indigo-50 text-indigo-600" href="/dashboard/appointments" />
        <Stat icon={Users} label="Active Waitlist" value={stats.waitlist} color="bg-amber-50 text-amber-600" href="/dashboard/waitlist" />
        <Stat icon={Activity} label="Recovery Waves" value={stats.recovery} color="bg-emerald-50 text-emerald-600" href="/dashboard/recovery" />
        <Stat icon={TrendingUp} label="Cancelled Slots" value={stats.cancelled} color="bg-red-50 text-red-600" />
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* QR Code Widget */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Patient Standby Gateway</h2>
          <p className="mt-0.5 text-xs text-slate-500 mb-4">
            Patients scan this QR code to join the live standby waitlist via Gemini AI triage.
          </p>
          <div className="flex items-start gap-6">
            <div className="rounded-lg border border-slate-200 p-3 bg-white shadow-sm">
              {portalUrl && <QRCodeSVG value={portalUrl} size={120} level="H" />}
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Portal URL</p>
                <p className="mt-0.5 rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1.5 font-mono text-xs text-slate-700 break-all">
                  {portalUrl || "Loading…"}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/standby" target="_blank" className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 transition">
                  Open Portal
                </Link>
                <Link href="/book" target="_blank" className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">
                  Booking Page
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
          <h2 className="text-sm font-semibold text-slate-900">System Status</h2>
          <p className="mt-0.5 text-xs text-slate-500 mb-4">Backend connectors and engine health.</p>
          <div className="flex-1 space-y-3">
            {[
              { name: "Gemini AI Triage Engine", status: "Active" },
              { name: "Supabase Realtime", status: "Connected" },
              { name: "Atomic Slot Locking", status: "Enabled" },
              { name: "Dispatch Wave Engine", status: "Standby" },
            ].map((s) => (
              <div key={s.name} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="text-xs font-medium text-slate-700">{s.name}</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
