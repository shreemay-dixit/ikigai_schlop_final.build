"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  HeartPulse, ArrowRight, Radio, LayoutDashboard,
  ShieldCheck, Zap, Users, CheckCircle2
} from "lucide-react";

export default function RootPage() {
  const [portalUrl, setPortalUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPortalUrl(`${window.location.origin}/portal`);
    }
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-rose-200 flex flex-col justify-between">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 lg:px-12 py-4 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500 text-white shadow-md shadow-rose-200">
            <HeartPulse className="h-4 w-4" />
          </div>
          <span className="text-lg font-black tracking-tight text-stone-900">Fillwell</span>
          <span className="hidden sm:inline-block rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
            Dual-View MVP
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 transition shadow-sm"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Operator Dashboard</span>
          </Link>
          <Link
            href="/portal"
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-500 transition shadow-md shadow-rose-600/20"
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Mobile Buzzer</span>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-1 text-xs font-bold text-stone-600 shadow-sm">
            <Zap className="h-3.5 w-3.5 text-rose-500 fill-current" /> Autonomous Clinical Slot Recovery
          </span>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-stone-900 leading-tight">
            The Zero-Friction <br />
            <span className="text-gradient-warm">Dual-View System</span>
          </h1>
          <p className="text-sm sm:text-base text-stone-600 font-medium">
            Instantly broadcast cancelled clinical openings to standby patients with sub-millisecond pessimistic row locks.
          </p>
        </div>

        {/* Dual View Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 max-w-4xl mx-auto w-full">
          {/* Card 1: Operator Dashboard */}
          <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-xl flex flex-col justify-between space-y-6 hover:border-stone-300 transition-all group">
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-md">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                View 1 · Desktop Optimized
              </span>
              <h2 className="text-2xl font-black tracking-tight text-stone-900">
                Operator Dashboard
              </h2>
              <p className="text-xs text-stone-500 leading-relaxed">
                Clinic schedule management, 1-click cancellation wave triggers, active standby radar queue, and live immutable audit streaming.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-stone-100">
              <div className="flex items-center gap-2 text-xs font-medium text-stone-600">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>1-Click Cancel & Wave Dispatch</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-stone-600">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Live Priority Standby Queue</span>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-stone-900 py-3.5 text-xs font-bold text-white shadow-md hover:bg-stone-800 transition"
            >
              <span>Launch Operator Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Card 2: Mobile Standby Buzzer */}
          <div className="rounded-3xl border-2 border-rose-200 bg-gradient-to-b from-white to-rose-50/40 p-8 shadow-xl flex flex-col justify-between space-y-6 hover:border-rose-300 transition-all group">
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-md shadow-rose-500/30">
                <Radio className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block font-mono">
                View 2 · Mobile Standby Radar
              </span>
              <h2 className="text-2xl font-black tracking-tight text-stone-900">
                Digital Buzzer Portal
              </h2>
              <p className="text-xs text-stone-500 leading-relaxed">
                Patient onboarding, live cancellation radar listener, urgent red buzzer state, and PostgreSQL atomic lock claiming.
              </p>
            </div>

            {/* QR Plug */}
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-white border border-rose-100 shadow-sm">
              <div className="shrink-0 p-1 rounded-xl border border-stone-100 bg-white">
                {portalUrl ? (
                  <QRCodeSVG value={portalUrl} size={64} level="M" />
                ) : (
                  <div className="h-16 w-16 bg-stone-100 rounded-lg animate-pulse" />
                )}
              </div>
              <div className="text-left text-xs">
                <p className="font-bold text-stone-900">Scan to Test on Phone</p>
                <p className="text-[11px] text-stone-500 mt-0.5">Or tap the button below in your browser.</p>
              </div>
            </div>

            <Link
              href="/portal"
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3.5 text-xs font-bold text-white shadow-lg shadow-rose-600/25 hover:bg-rose-500 transition"
            >
              <span>Launch Mobile Standby Portal</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-4 px-6 text-center text-xs text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-stone-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>HIPAA Compliant · PostgreSQL Atomic Locking · Supabase Realtime</span>
        </div>
        <p className="text-[11px] font-mono text-stone-400">Fillwell Dual-View System v2.0</p>
      </footer>
    </div>
  );
}
