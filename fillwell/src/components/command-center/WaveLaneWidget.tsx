"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  AlertCircle,
  Clock,
  FastForward,
  PauseCircle,
  PlayCircle,
  UserPlus,
  Radio,
  CheckCircle2,
} from "lucide-react";
import { RecoveryEvent } from "@/lib/types/database";
import { formatTimeOnly } from "@/lib/utils";
import { toast } from "sonner";

interface WaveLaneWidgetProps {
  recoveryEvents: RecoveryEvent[];
  onRefresh: () => void;
  onOpenInspector: (appointmentId: string) => void;
}

export function WaveLaneWidget({
  recoveryEvents,
  onRefresh,
  onOpenInspector,
}: WaveLaneWidgetProps) {
  const [overrideLoading, setOverrideLoading] = useState<string | null>(null);
  const [showWalkinModal, setShowWalkinModal] = useState<RecoveryEvent | null>(null);
  const [walkinName, setWalkinName] = useState("");
  const [walkinPhone, setWalkinPhone] = useState("");

  const activeEvent = recoveryEvents.find(
    (r) => r.status === "active" || r.status === "paused"
  );

  async function handleOverride(
    eventId: string,
    action: "pause" | "resume" | "next_wave" | "force_assign",
    wName?: string,
    wPhone?: string
  ) {
    try {
      setOverrideLoading(eventId);
      const res = await fetch("/api/recovery/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recovery_event_id: eventId,
          action,
          walk_in_patient_name: wName,
          walk_in_patient_phone: wPhone,
        }),
      });

      if (!res.ok) throw new Error("Failed to execute override");
      toast.success(
        action === "pause"
          ? "Automated wave paused."
          : action === "resume"
          ? "Automated wave resumed."
          : action === "next_wave"
          ? "Triggered next recovery wave."
          : "Slot force-assigned to walk-in!"
      );
      setShowWalkinModal(null);
      setWalkinName("");
      setWalkinPhone("");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to execute recovery action");
    } finally {
      setOverrideLoading(null);
    }
  }

  if (!activeEvent) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-200">
                Wave Lane Telemetry
              </h4>
              <p className="text-[11px] text-slate-500">
                No active cancellations. System standing by.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            AUTOPILOT ARMED
          </span>
        </div>
      </div>
    );
  }

  const isPaused = activeEvent.status === "paused";
  const apt = activeEvent.appointment;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-slate-900/90 to-slate-900 p-4 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Telemetry Details */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Radio className="h-5 w-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-100">
                Active Slot Recovery — Wave #{activeEvent.wave_number}
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  isPaused
                    ? "bg-slate-800 text-slate-300 border-slate-700"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                }`}
              >
                {isPaused ? "PAUSED" : "DISPATCHING (TTL 3m)"}
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-0.5">
              Slot:{" "}
              <strong className="text-slate-200">
                {apt ? `${formatTimeOnly(apt.start_time)} (${apt.service_type})` : "10:00 AM"}
              </strong>{" "}
              &bull; Targeting{" "}
              <span className="text-amber-400 font-semibold">
                {activeEvent.offers?.length || 2} Top Priority Candidates
              </span>
            </p>
          </div>
        </div>

        {/* Right Manual Override Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onOpenInspector(activeEvent.appointment_id)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            Inspect AI Trail
          </button>

          {isPaused ? (
            <button
              disabled={overrideLoading === activeEvent.id}
              onClick={() => handleOverride(activeEvent.id, "resume")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Resume Wave
            </button>
          ) : (
            <button
              disabled={overrideLoading === activeEvent.id}
              onClick={() => handleOverride(activeEvent.id, "pause")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              Pause Wave
            </button>
          )}

          <button
            disabled={overrideLoading === activeEvent.id}
            onClick={() => handleOverride(activeEvent.id, "next_wave")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
          >
            <FastForward className="h-3.5 w-3.5" />
            Next Wave
          </button>

          <button
            onClick={() => setShowWalkinModal(activeEvent)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <UserPlus className="h-3.5 w-3.5 text-cyan-400" />
            Force Walk-in
          </button>
        </div>
      </div>

      {/* Walkin Modal */}
      {showWalkinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-1">
              Force-Assign Slot to Walk-in
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Instantly cancels automated wave dispatch and claims the slot for an in-clinic patient.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Walk-in Patient Name
                </label>
                <input
                  type="text"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="e.g. Maria Gonzalez"
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Phone Number (E.164)
                </label>
                <input
                  type="tel"
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                  placeholder="+1 (555) 987-6543"
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowWalkinModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleOverride(showWalkinModal.id, "force_assign", walkinName, walkinPhone)
                }
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition"
              >
                Confirm Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
