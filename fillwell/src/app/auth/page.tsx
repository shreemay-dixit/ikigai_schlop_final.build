"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, ShieldCheck, Lock, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [orgCode, setOrgCode] = useState("METRO-HEALTH-01");
  const [loading, setLoading] = useState(false);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Authenticated successfully!");
      router.push("/setup");
    }, 600);
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Gemini Aurora Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 p-[1px] shadow-2xl shadow-purple-500/20 mb-2">
            <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-slate-950">
              <Sparkles className="h-6 w-6 text-indigo-400" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Fillwell Intelligence
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Autonomous clinical scheduling, voice AI dispatch, and slot recovery.
          </p>
        </div>

        {/* Minimal Auth Card */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <span className="text-xs font-bold text-slate-200">Organization Login</span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              SECURE SSO
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Organization Access Key / Code
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value)}
                  placeholder="e.g. ORG-ENTERPRISE-01"
                  required
                  className="w-full rounded-xl bg-slate-950/90 border border-slate-800 pl-9 pr-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-purple-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Operator Email Address
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@metrohealth.org"
                  required
                  className="w-full rounded-xl bg-slate-950/90 border border-slate-800 pl-9 pr-3 py-2 text-xs text-slate-100 outline-none focus:border-purple-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-purple-600/25 transition disabled:opacity-50"
            >
              <span>{loading ? "Authenticating..." : "Enter Organization Workspace"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => router.push("/setup")}
              className="text-[11px] text-slate-400 hover:text-indigo-400 transition"
            >
              New Organization? <strong>Run Setup Wizard &rarr;</strong>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
