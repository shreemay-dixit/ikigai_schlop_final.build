"use client";

import React, { useState } from "react";
import { X, Calendar, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface GoogleCalendarSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function GoogleCalendarSignInModal({
  isOpen,
  onClose,
  onSuccess,
}: GoogleCalendarSignInModalProps) {
  const [email, setEmail] = useState("dr.lin@metrohealth.org");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(true);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", email }),
      });

      if (!res.ok) throw new Error("Failed to authenticate Google Calendar");
      setConnected(true);
      toast.success("Google Calendar connected and synchronized!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-stone-900 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/30">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-100">
                Google Calendar Sign-In
              </h3>
              <p className="text-[10px] text-stone-400 font-mono">
                OAuth 2.0 Integration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-stone-300 leading-relaxed">
          Authenticate your Google Workspace or clinical account to enable two-way sync of clinician schedules, open slot detection, and automated booking events.
        </p>

        <form onSubmit={handleConnect} className="space-y-4 pt-1">
          <div>
            <label className="text-[11px] font-semibold text-stone-300 block mb-1">
              Google Account Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="clinician@health.org"
              required
              className="w-full rounded-xl bg-stone-950 border border-stone-800 px-3 py-2 text-xs text-stone-100 outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Encrypted OAuth2 token storage. Access restricted to calendar scopes.</span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-600/25 transition disabled:opacity-50"
            >
              <span>{loading ? "Authenticating..." : "Authorize Google Calendar"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
