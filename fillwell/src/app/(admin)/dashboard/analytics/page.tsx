"use client";

import React, { useEffect, useState } from "react";
import { Calendar, Users, Activity, TrendingUp, Zap, RefreshCw, ChevronRight, Loader2, DollarSign, Clock, FileText, BarChart2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

// Animated counter component
function AnimatedCounter({ value }: { value: number | string }) {
  const [display, setDisplay] = useState(0);
  const numericVal = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, "")) : value;
  const isString = typeof value === 'string';

  useEffect(() => {
    let start = 0;
    const duration = 1000;
    const increment = numericVal / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= numericVal) {
        clearInterval(timer);
        setDisplay(numericVal);
      } else setDisplay(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [numericVal]);

  return <span>{isString && value.toString().includes("$") ? `$${display}` : display}</span>;
}

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState({ appointments: 0, waitlist: 0, recovery: 0, cancelled: 0, revenueSaved: 0 });
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
      const [aptRes, waitRes, recRes] = await Promise.all([
        fetch("/api/appointments").then((r) => r.json()),
        fetch("/api/waitlist").then((r) => r.json()),
        fetch("/api/recovery/override").then((r) => r.json()),
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
    <div className="group relative overflow-hidden rounded-xl border border-stone-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
      <div className={`absolute -right-6 -top-6 h-32 w-32 rounded-full ${color.includes('emerald') ? 'bg-emerald-500' : color.includes('indigo') ? 'bg-rose-500' : color.includes('amber') ? 'bg-amber-500' : 'bg-stone-500'} opacity-10 blur-2xl transition-transform duration-500 group-hover:scale-125`} />
      <div className="relative flex items-center justify-between z-10">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-inner ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        {href && (
          <Link href={href} className="text-[11px] font-bold uppercase tracking-wider text-stone-400 hover:text-rose-600 flex items-center gap-1 transition-colors">
            View <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="relative mt-5 z-10">
        <p className="text-4xl font-black tracking-tight text-stone-900 tabular-nums">
          {loading ? <span className="inline-block h-9 w-20 animate-pulse rounded bg-stone-100" /> : <AnimatedCounter value={value} />}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{label}</p>
          {trend && (
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${trendUp ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
              {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />} {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2"><BarChart2 className="h-6 w-6 text-rose-600" />Business Analytics</h1>
          <p className="text-sm text-stone-500">Real-time telemetry and revenue performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSeed} disabled={seeding} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-50">
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-amber-500" />}
            Seed Sandbox Data
          </button>
          <button onClick={handleReset} disabled={seeding} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-600 shadow-sm transition hover:bg-stone-50 disabled:opacity-50">
            <RefreshCw className="h-4 w-4 text-stone-400" /> Factory Reset
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Revenue Saved" value={`$${stats.revenueSaved}`} trend="12%" trendUp={true} color="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white" />
        <Stat icon={Users} label="Waitlisted" value={stats.waitlist} trend="4%" trendUp={true} color="bg-gradient-to-br from-rose-500 to-blue-600 text-white" href="/dashboard" />
        <Stat icon={Activity} label="Recoveries" value={stats.recovery} color="bg-gradient-to-br from-amber-400 to-orange-500 text-white" href="/dashboard/recovery" />
        <Stat icon={Calendar} label="Bookings" value={stats.appointments} trend="2%" trendUp={false} color="bg-gradient-to-br from-stone-700 to-stone-900 text-white" href="/dashboard/appointments" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* CSS Chart: Capacity Utilization */}
        <div className="lg:col-span-2 rounded-xl border border-stone-200 bg-white p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold text-stone-900">24h Queue Volume (Simulated)</h2>
            <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Triage</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Claims</span>
            </div>
          </div>
          <div className="flex-1 flex items-end gap-2 h-48 relative">
            {/* Y-Axis lines */}
            <div className="absolute inset-0 flex flex-col justify-between border-l border-stone-100 pl-2">
              {[100, 75, 50, 25, 0].map(v => <span key={v} className="text-[9px] text-stone-300 font-mono -ml-6">{v}</span>)}
            </div>
            {/* CSS Bar Chart */}
            {Array.from({ length: 24 }).map((_, i) => {
              const h1 = Math.floor(Math.random() * 60) + 20; // Simulated data
              const h2 = Math.floor(Math.random() * 40) + 10;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end gap-0.5 group relative">
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap">
                    Hour {i}: {h1} Triaged
                  </div>
                  <div className="w-full bg-emerald-400 rounded-t-sm transition-all duration-700 ease-out hover:brightness-110" style={{ height: `${h2}%` }} />
                  <div className="w-full bg-rose-500 rounded-b-sm transition-all duration-700 ease-out hover:brightness-110" style={{ height: `${h1}%` }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* QR Code Widget */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm flex flex-col">
          <h2 className="text-sm font-bold text-stone-900 mb-1">Patient Standby Gateway</h2>
          <p className="text-[11px] text-stone-500 mb-5">
            QR link for patients to join the live standby waitlist via Gemini AI triage.
          </p>
          <div className="flex flex-col items-center flex-1 justify-center border-2 border-dashed border-stone-100 rounded-xl p-4 bg-stone-50/50 hover:bg-stone-50 transition-colors">
            <div className="rounded-xl border border-stone-200 p-4 bg-white shadow-sm mb-4">
              {portalUrl && <QRCodeSVG value={portalUrl} size={130} level="H" />}
            </div>
            <div className="w-full flex flex-col gap-2">
              <Link href="/standby" target="_blank" className="w-full inline-flex justify-center items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 transition">
                Open Standby Portal <ChevronRight className="h-4 w-4" />
              </Link>
              <Link href="/book" target="_blank" className="w-full inline-flex justify-center items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50 transition">
                Open Booking Portal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
