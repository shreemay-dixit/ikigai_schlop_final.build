"use client";

import React, { useState } from "react";
import { X, FlaskConical, PlayCircle, Trash2, RefreshCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface SandboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function SandboxModal({ isOpen, onClose, onRefresh }: SandboxModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "seed" | "reset") {
    setLoading(true);
    try {
      const res = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error("Failed to execute sandbox action");
      const data = await res.json();
      toast.success(data.message || "Sandbox action executed successfully!");
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <FlaskConical className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Behind the Scenes Sandbox
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Developer Simulation Controls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Production mode runs with clean, unpolluted data. Use these sandbox triggers to test wave recovery workflows, simulated cancellations, and audit trails without modifying production logic.
        </p>

        <div className="space-y-2.5 pt-1">
          <button
            disabled={loading}
            onClick={() => handleAction("seed")}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 group-hover:scale-105 transition">
              <PlayCircle className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100">
                Inject Test Recovery Wave Scenario
              </div>
              <div className="text-[10px] text-slate-400">
                Populates 1 active wave recovery slot, waitlisted candidates & audit logs.
              </div>
            </div>
          </button>

          <button
            disabled={loading}
            onClick={() => handleAction("reset")}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 group-hover:scale-105 transition">
              <Trash2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-rose-300">
                Purge All Records (Clean Slate)
              </div>
              <div className="text-[10px] text-slate-400">
                Clears appointments, waitlist, and recovery waves to pristine state.
              </div>
            </div>
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
