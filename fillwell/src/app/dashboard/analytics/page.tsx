"use client";

import React, { useEffect, useState } from "react";
import { Calendar, Users, Activity, TrendingUp, Zap, RefreshCw, ChevronRight, Loader2, DollarSign, Clock, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

export default function DashboardOverview() {
  const [stats, setStats] = useState({ appointments: 0, waitlist: 0, recovery: 0, cancelled: 0, revenueSaved: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [portalUrl, setPortalUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setPortalUrl(`${window.location.origin}/standby`);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aptRes, waitRes, recRes, auditRes] = await Promise.all([
        fetch("/api/appointments").then((r) => r.json()),
        fetch("/api/waitlist").then((r) => r.json()),
        fetch("/api/recovery/override").then((r) => r.json()),
        fetch("/api/audit").then((r) => r.json()),
      ]);
      const apts = aptRes.data || [];
      const recoveredCount = apts.filter((a: any) => a.status === "recovered").length;
      
      setStats({
        appointments: apts.length,
        waitlist: (waitRes.data || []).filter((w: any) => w.is_active).length,
        recovery: (recRes.data || []).length,
        cancelled: apts.filter((a: any) => a.status === "cancelled").length,
        revenueSaved: recoveredCount * 150, // Mock $150 per recovered slot
      });
      setLogs((auditRes.data || []).reverse().slice(0, 5));
    } catch { }
    setLoading(false);
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await fetch("/api/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "seed" }) });
      toast.success("Demo data seeded");
      fetchData();
    } catch { toast.error("Seed failed"); }
    setSeeding(false);
  };

  const handleReset = async () => {
    setSeeding(true);
    try {
      await fetch("/api/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset" }) });
      toast.success("Database reset to clean state");
      fetchData();
    } catch { toast.error("Reset failed"); }
    setSeeding(false);
  };

  const Stat = ({ icon: Icon, label, value, trend, trendUp, color, href }: any) => (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-indigo-50 to-transparent opacity-50 transition-transform group-hover:scale-110" />
      <div className="relative flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        {href && (
          <Link href={href} className="text-[11px] font-semibold text-slate-400 hover:text-indigo-600 flex items-center gap-0.5 transition-colors">
            Details <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="relative mt-4">
        <p className="text-3xl font-bold tracking-tight text-slate-900">
          {loading ? <span className="inline-block h-8 w-16 animate-pulse rounded-md bg-slate-100" /> : value}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          {trend && (
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-6xl pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Business intelligence and operational overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSeed} disabled={seeding} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
            {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-amber-500" />}
            Seed Data
          </button>
          <button onClick={handleReset} disabled={seeding} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" /> Reset
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Revenue Saved" value={`$${stats.revenueSaved}`} trend="+12% wk" trendUp={true} color="bg-emerald-500 text-white" />
        <Stat icon={Users} label="Waitlisted Patients" value={stats.waitlist} trend="+4% wk" trendUp={true} color="bg-indigo-600 text-white" href="/dashboard/waitlist" />
        <Stat icon={Activity} label="Active Recoveries" value={stats.recovery} color="bg-amber-500 text-white" href="/dashboard/recovery" />
        <Stat icon={Calendar} label="Total Bookings" value={stats.appointments} trend="-2% wk" trendUp={false} color="bg-slate-800 text-white" href="/dashboard/appointments" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content Area (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* QR Code Widget */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <div className="rounded-xl border border-slate-200 p-3 bg-white shadow-sm shrink-0">
              {portalUrl && <QRCodeSVG value={portalUrl} size={110} level="H" />}
            </div>
            <div className="space-y-4 w-full">
              <div>
                <h2 className="text-base font-bold text-slate-900">Patient Standby Gateway</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Patients scan this QR code to join the live standby waitlist via Gemini AI triage. Displays realtime radar for open slots.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/standby" target="_blank" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition">
                  Open Standby <ChevronRight className="h-4 w-4" />
                </Link>
                <Link href="/book" target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition">
                  Booking Portal
                </Link>
              </div>
            </div>
          </div>
          
          {/* System Status */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">Infrastructure Health</h2>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Operational
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { name: "Gemini Triage", status: "Active" },
                { name: "WebSockets", status: "Connected" },
                { name: "Atomic Locks", status: "Enabled" },
                { name: "Wave Engine", status: "Standby" },
              ].map((s) => (
                <div key={s.name} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">{s.name}</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{s.status}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Activity Feed (1/3 width) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col h-full overflow-hidden">
          <div className="border-b border-slate-100 p-5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Clock className="h-4 w-4 text-indigo-600" /> Recent Activity</h2>
            <Link href="/dashboard/audit" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">View All</Link>
          </div>
          <div className="flex-1 p-5 overflow-y-auto bg-slate-50/50">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />)}
              </div>
            ) : logs.length ? (
              <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-slate-200">
                {logs.map((log) => (
                  <div key={log.id} className="relative flex gap-3">
                    <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px]">
                      <FileText className="h-3 w-3 text-slate-500" />
                    </div>
                    <div className="flex-1 pb-1">
                      <p className="text-xs font-semibold text-slate-900">{log.event_type.replace(/_/g, " ")}</p>
                      <p className="text-[10px] text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">No recent activity.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
