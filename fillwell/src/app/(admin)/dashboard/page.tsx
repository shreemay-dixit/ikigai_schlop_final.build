"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar, Users, FileText, LayoutDashboard, HeartPulse,
  Radio, RefreshCw, Zap, ShieldCheck, Search, Bell, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { SchedulePanel, AppointmentItem } from "@/components/dashboard/SchedulePanel";
import { WaitlistPanel, WaitlistItem } from "@/components/dashboard/WaitlistPanel";
import { AuditFeed, AuditItem } from "@/components/dashboard/AuditFeed";

export default function OperatorDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "schedule" | "waitlist" | "audit">("overview");
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string>("");

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const [aptRes, wlRes, auditRes] = await Promise.all([
        fetch("/api/appointments").then((r) => r.json()),
        fetch("/api/waitlist").then((r) => r.json()),
        fetch("/api/audit").then((r) => r.json()),
      ]);

      if (aptRes.success && Array.isArray(aptRes.data)) {
        setAppointments(aptRes.data);
      }
      if (wlRes.success && Array.isArray(wlRes.data)) {
        setWaitlist(wlRes.data);
      }
      if (auditRes.success && Array.isArray(auditRes.data)) {
        setAuditLogs(auditRes.data.reverse());
      }
      setLastSync(new Date().toLocaleTimeString());
    } catch (err: any) {
      if (!silent) toast.error("Failed to sync dashboard data");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 2500); // Live poll every 2.5s
    return () => clearInterval(interval);
  }, []);

  const activeAppointments = appointments.filter((a) => a.status === "confirmed").length;
  const buzzingSlots = appointments.filter((a) => a.status === "cancelled" || a.status === "recovering").length;
  const activeStandbyPatients = waitlist.filter((w) => w.is_active).length;

  return (
    <div className="flex min-h-screen bg-stone-50 text-stone-900 font-sans">
      {/* ── Sidebar ── */}
      <aside className="w-64 bg-stone-900 text-white flex flex-col justify-between shrink-0 border-r border-stone-800 hidden md:flex">
        <div>
          {/* Brand */}
          <div className="flex h-16 items-center gap-3 px-6 border-b border-stone-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500 text-white shadow-md shadow-rose-500/20">
              <HeartPulse className="h-4 w-4" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white">Fillwell</span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">Operator Command</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-3 space-y-1 mt-3">
            <button
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === "overview"
                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Command Center</span>
            </button>

            <button
              onClick={() => setActiveTab("schedule")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === "schedule"
                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4" />
                <span>Schedule Grid</span>
              </div>
              {buzzingSlots > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
                  {buzzingSlots}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("waitlist")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === "waitlist"
                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4" />
                <span>Standby Radar</span>
              </div>
              {activeStandbyPatients > 0 && (
                <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
                  {activeStandbyPatients}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("audit")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === "audit"
                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Audit Feed</span>
            </button>
          </nav>
        </div>

        {/* Footer info & Link to Mobile Portal */}
        <div className="p-4 border-t border-stone-800 space-y-3">
          <Link
            href="/portal"
            target="_blank"
            className="flex items-center justify-between rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 p-3 text-xs font-bold text-white shadow-lg shadow-rose-600/20 hover:scale-[1.02] transition"
          >
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 animate-pulse" />
              <span>Digital Buzzer (Mobile)</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </Link>

          <div className="flex items-center justify-between text-[10px] font-mono text-stone-500">
            <span>Atomic Engine v2.0</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" /> LIVE
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-stone-200 bg-white/90 px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            {/* Mobile Tab Pills */}
            <div className="flex md:hidden items-center gap-1 rounded-xl bg-stone-100 p-1">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  activeTab === "overview" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab("schedule")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  activeTab === "schedule" ? "bg-white text-rose-600 shadow-sm" : "text-stone-500"
                }`}
              >
                Schedule
              </button>
              <button
                onClick={() => setActiveTab("waitlist")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  activeTab === "waitlist" ? "bg-white text-amber-600 shadow-sm" : "text-stone-500"
                }`}
              >
                Waitlist
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-stone-700">Metro Urgent Care Clinic</span>
              <span className="text-stone-300">|</span>
              <span className="text-xs font-mono text-stone-500">
                Last Sync: {lastSync || "Connecting..."}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-100 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Force Sync</span>
            </button>

            <Link
              href="/portal"
              target="_blank"
              className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-stone-800 transition"
            >
              <Radio className="h-3.5 w-3.5 text-rose-400" />
              <span>Launch Buzzer Portal &rarr;</span>
            </Link>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto space-y-6 max-w-7xl w-full mx-auto">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Active Bookings</p>
                <p className="text-2xl font-black text-stone-900 mt-1">{activeAppointments}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Calendar className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Standby Radar Queue</p>
                <p className="text-2xl font-black text-amber-600 mt-1">{activeStandbyPatients}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Users className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Buzzing Recoveries</p>
                <p className="text-2xl font-black text-rose-600 mt-1">{buzzingSlots}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Zap className="h-5 w-5 fill-current" />
              </div>
            </div>
          </div>

          {/* Tab Views */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <SchedulePanel
                appointments={appointments}
                loading={loading}
                onRefresh={() => fetchData(true)}
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <WaitlistPanel
                  waitlist={waitlist}
                  loading={loading}
                  onRefresh={() => fetchData(true)}
                />
                <AuditFeed
                  logs={auditLogs}
                  loading={loading}
                  onRefresh={() => fetchData(true)}
                />
              </div>
            </div>
          )}

          {activeTab === "schedule" && (
            <SchedulePanel
              appointments={appointments}
              loading={loading}
              onRefresh={() => fetchData(true)}
            />
          )}

          {activeTab === "waitlist" && (
            <WaitlistPanel
              waitlist={waitlist}
              loading={loading}
              onRefresh={() => fetchData(true)}
            />
          )}

          {activeTab === "audit" && (
            <AuditFeed
              logs={auditLogs}
              loading={loading}
              onRefresh={() => fetchData(true)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
