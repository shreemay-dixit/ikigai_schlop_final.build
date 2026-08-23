"use client";

import React, { useState } from "react";
import { Sliders, Moon, Zap, Save, Check } from "lucide-react";
import { ClinicSettings } from "@/lib/types/database";
import { toast } from "sonner";

interface AutomationConfigCardProps {
  settings: ClinicSettings | null;
  onRefresh: () => void;
}

export function AutomationConfigCard({
  settings,
  onRefresh,
}: AutomationConfigCardProps) {
  const [waveSize, setWaveSize] = useState(settings?.wave_size || 4);
  const [waveTimeout, setWaveTimeout] = useState(settings?.wave_timeout_mins || 5);
  const [quietStart, setQuietStart] = useState(settings?.quiet_hours_start?.slice(0, 5) || "21:00");
  const [quietEnd, setQuietEnd] = useState(settings?.quiet_hours_end?.slice(0, 5) || "08:00");
  const [autoEnabled, setAutoEnabled] = useState(settings?.auto_recovery_enabled ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    try {
      setSaving(true);
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wave_size: waveSize,
          wave_timeout_mins: waveTimeout,
          quiet_hours_start: `${quietStart}:00`,
          quiet_hours_end: `${quietEnd}:00`,
          auto_recovery_enabled: autoEnabled,
        }),
      });

      if (!res.ok) throw new Error("Failed to save settings");
      toast.success("Automation parameters updated successfully!");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-stone-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-100">
              Autonomous Slot Recovery Engine Config
            </h3>
            <p className="text-xs text-stone-400">
              Control wave dispatch sizes, candidate timeouts, and patient quiet hours.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/25 transition disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving..." : "Save Parameters"}
        </button>
      </div>

      <div className="space-y-6">
        {/* Wave Size Slider */}
        <div className="rounded-xl border border-stone-800 bg-stone-950 p-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="text-xs font-bold text-stone-200 block">
                Wave Size (Candidates per Wave)
              </span>
              <span className="text-[11px] text-stone-400">
                Number of top waitlisted patients notified simultaneously in Wave 1.
              </span>
            </div>
            <span className="text-sm font-mono font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/20">
              {waveSize} Patients
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="8"
            value={waveSize}
            onChange={(e) => setWaveSize(parseInt(e.target.value))}
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-stone-500 font-mono mt-1">
            <span>1 Patient (Strict Sequential)</span>
            <span>4 (Optimal)</span>
            <span>8 Patients (High Urgency)</span>
          </div>
        </div>

        {/* Wave Timeout Slider */}
        <div className="rounded-xl border border-stone-800 bg-stone-950 p-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="text-xs font-bold text-stone-200 block">
                Wave Response Timeout (TTL)
              </span>
              <span className="text-[11px] text-stone-400">
                Time granted to candidates before triggering the subsequent wave.
              </span>
            </div>
            <span className="text-sm font-mono font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/20">
              {waveTimeout} Minutes
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="15"
            value={waveTimeout}
            onChange={(e) => setWaveTimeout(parseInt(e.target.value))}
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-stone-500 font-mono mt-1">
            <span>1 Min (Flash Fill)</span>
            <span>5 Mins (Recommended)</span>
            <span>15 Mins (Relaxed)</span>
          </div>
        </div>

        {/* Quiet Hours Picker */}
        <div className="rounded-xl border border-stone-800 bg-stone-950 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-amber-400" />
            <div>
              <span className="text-xs font-bold text-stone-200 block">
                Patient Quiet Hours Schedule
              </span>
              <span className="text-[11px] text-stone-400">
                Outbound pings are queued and held during overnight quiet hours.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <label className="text-[11px] font-mono text-stone-400 block mb-1">
                Quiet Hours Start
              </label>
              <input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                className="w-full rounded-lg bg-stone-900 border border-stone-800 px-3 py-2 text-xs text-stone-100 font-mono outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-stone-400 block mb-1">
                Quiet Hours End (Morning Release)
              </label>
              <input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                className="w-full rounded-lg bg-stone-900 border border-stone-800 px-3 py-2 text-xs text-stone-100 font-mono outline-none focus:border-rose-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
