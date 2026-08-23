"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Heart, ArrowRight, ShieldCheck, Clock, CheckCircle2 } from "lucide-react";

export default function RootPage() {
  const [portalUrl, setPortalUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPortalUrl(`${window.location.origin}/standby`);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9f8] text-slate-900 font-sans selection:bg-rose-200">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4 bg-white/70 backdrop-blur-md border-b border-rose-100">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500 text-white shadow-md shadow-rose-200">
            <Heart className="h-4 w-4 fill-current" />
          </div>
          <span className="text-xl font-black tracking-tight text-slate-800">Fillwell</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-rose-500 transition-colors">Clinic Login</Link>
          <Link href="/book" className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 shadow-lg shadow-slate-200">
            Book Appointment
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-24 overflow-hidden">
        {/* Abstract Background Orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none -z-10">
          <div className="absolute -top-32 left-0 w-[500px] h-[500px] rounded-full bg-rose-100/50 blur-[100px] opacity-70" />
          <div className="absolute top-64 right-0 w-[600px] h-[600px] rounded-full bg-amber-100/40 blur-[120px] opacity-70" />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-16">
          {/* Left: Copy */}
          <div className="flex-1 space-y-8 text-center lg:text-left z-10 animate-page-in">
            <h1 className="text-5xl lg:text-7xl font-black tracking-tight text-slate-900 leading-[1.1]">
              Healthcare that <br className="hidden lg:block"/>
              actually <span className="text-gradient-warm">cares</span>.
            </h1>
            <p className="text-lg lg:text-xl text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
              Join the live standby queue in seconds. Our AI-driven triage ensures you get the right care, right when you need it most.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
              <Link href="/standby" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-rose-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-rose-200 transition-all hover:bg-rose-600 hover:scale-[1.02] active:scale-[0.98]">
                Join Standby Queue <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/book" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border-2 border-slate-200 bg-white/50 px-8 py-4 text-base font-bold text-slate-700 backdrop-blur-sm transition-all hover:border-rose-200 hover:bg-white hover:text-rose-600">
                Schedule for Later
              </Link>
            </div>
            
            <div className="pt-8 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm font-semibold text-slate-500">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500"/> Walk-ins Welcome</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500"/> Zero Paperwork</span>
            </div>
          </div>

          {/* Right: The QR "Plug" */}
          <div className="w-full max-w-md lg:w-[480px] shrink-0 animate-page-in" style={{ animationDelay: "150ms" }}>
            <div className="relative rounded-[2rem] border border-white/50 bg-white/60 p-8 shadow-2xl shadow-rose-500/10 backdrop-blur-xl">
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/80 to-white/20 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-800">Scan to Check-In</h2>
                  <p className="text-sm font-medium text-slate-500">
                    Use your phone's camera to jump the line. Our AI will triage your symptoms instantly.
                  </p>
                </div>
                
                <div className="group relative rounded-3xl border-4 border-rose-100 bg-white p-6 shadow-sm transition-transform hover:scale-105 hover:border-rose-200">
                  <div className="absolute -inset-4 rounded-[2.5rem] bg-rose-50 opacity-0 transition-opacity group-hover:opacity-100 -z-10" />
                  {portalUrl ? (
                    <QRCodeSVG value={portalUrl} size={180} level="H" fgColor="#1e293b" />
                  ) : (
                    <div className="w-[180px] h-[180px] flex items-center justify-center bg-slate-50 rounded-xl">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-500" />
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full pt-4 border-t border-slate-100">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-500 mb-1">
                      <Clock className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Wait</span>
                    <span className="text-lg font-black text-slate-700">&lt; 15m</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-500 mb-1">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Privacy</span>
                    <span className="text-lg font-black text-slate-700">HIPAA</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Mobile tap target overlay for the QR code (since scanning on the same device is impossible) */}
            <Link href="/standby" className="lg:hidden mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-4 text-sm font-bold text-white shadow-lg">
              Tap here to enter Standby Portal
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
