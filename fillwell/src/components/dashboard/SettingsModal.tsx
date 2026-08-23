"use client";

import React, { useState, useEffect } from "react";
import {
  Settings, X, Calendar, Clock, Sliders, Moon,
  Zap, RefreshCw, Trash2, CheckCircle2, AlertCircle,
  Loader2, Save, Sparkles, Building2, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"calendar" | "capacity" | "automation" | "sandbox">("calendar");

  // Form State
  const [simulatedDateTime, setSimulatedDateTime] = useState<string>("");
  const [isSimulatedActive, setIsSimulatedActive] = useState(false);
  const [waveSize, setWaveSize] = useState<number>(3);
  const [waveTimeoutMins, setWaveTimeoutMins] = useState<number>(5);
  const [quietHoursStart, setQuietHoursStart] = useState<string>("21:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>("08:00");
  const [autoRecoveryEnabled, setAutoRecoveryEnabled] = useState<boolean>(true);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing settings on mount / open
  useEffect(() => {
    if (!isOpen) return;

    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.success && json.data) {
          const s = json.data;
          setWaveSize(s.wave_size || 3);
          setWaveTimeoutMins(s.wave_timeout_mins || 5);
          setQuietHoursStart(s.quiet_hours_start?.slice(0, 5) || "21:00");
          setQuietHoursEnd(s.quiet_hours_end?.slice(0, 5) || "08:00");
          setAutoRecoveryEnabled(s.auto_recovery_enabled ?? true);

          if (s.simulated_date_time) {
            setSimulatedDateTime(new Date(s.simulated_date_time).toISOString().slice(0, 16));
            setIsSimulatedActive(true);
          } else {
            setSimulatedDateTime(new Date().toISOString().slice(0, 16));
            setIsSimulatedActive(false);
          }
        }
      } catch {
        toast.error("Failed to load current settings");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        wave_size: Number(waveSize),
        wave_timeout_mins: Number(waveTimeoutMins),
        quiet_hours_start: `${quietHoursStart}:00`,
        quiet_hours_end: `${quietHoursEnd}:00`,
        auto_recovery_enabled: autoRecoveryEnabled,
        simulated_date_time: isSimulatedActive && simulatedDateTime ? new Date(simulatedDateTime).toISOString() : null,
      };

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save settings");
      }

      toast.success("Settings updated successfully!", {
        description: isSimulatedActive
          ? `Simulated Calendar set to: ${new Date(simulatedDateTime).toLocaleString()}`
          : "Using live system clock.",
      });

      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSeedSandbox = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Demo schedule & standby patients seeded!");
        onSaved();
      }
    } catch {
      toast.error("Failed to seed sandbox");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSandbox = async () => {
    if (!confirm("Are you sure you want to purge all appointments and waitlist entries?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Database purged to clean state!");
        onSaved();
      }
    } catch {
      toast.error("Failed to reset database");
    } finally {
      setLoading(false);
    }
  };

  // Preview Day/Date
  const previewDate = isSimulatedActive && simulatedDateTime ? new Date(simulatedDateTime) : new Date();
  const previewDayString = previewDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const previewTimeString = previewDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-page-in">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-3xl bg-white shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4 bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-white shadow-sm">
              <Settings className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 leading-tight">System & Calendar Controls</h2>
              <p className="text-xs text-stone-500">Configure simulated date/time, wave dispatch capacity, and sandbox triggers.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl p-2 text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-100 px-6 bg-white gap-2 pt-2">
          {[
            { id: "calendar", label: "📅 Calendar & Date Override", icon: Calendar },
            { id: "capacity", label: "⚡ Wave Capacity", icon: Sliders },
            { id: "automation", label: "🌙 Quiet Hours & AI", icon: Moon },
            { id: "sandbox", label: "🔄 Sandbox Demo", icon: RefreshCw },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
                activeTab === tab.id
                  ? "border-rose-500 text-rose-600"
                  : "border-transparent text-stone-400 hover:text-stone-700"
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: CALENDAR & DATE OVERRIDE */}
          {activeTab === "calendar" && (
            <div className="space-y-5 animate-page-in">
              {/* Preview Banner */}
              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 font-mono">
                    {isSimulatedActive ? "⚡ Simulated Calendar Active" : "🕒 Real-Time System Clock"}
                  </span>
                  <p className="text-sm font-black text-stone-900">{previewDayString}</p>
                  <p className="text-xs font-mono text-stone-600">{previewTimeString} EST</p>
                </div>
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-rose-100 shadow-sm text-xs font-bold text-rose-600">
                  <Calendar className="h-4 w-4" />
                  <span>Gemini Context Synchronized</span>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50/50 p-4">
                <div>
                  <h4 className="text-xs font-bold text-stone-800">Enable Custom Date/Time Simulation</h4>
                  <p className="text-[11px] text-stone-500">Override the system clock to test weekday vs weekend triage and after-hours behavior.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={isSimulatedActive}
                    onChange={(e) => setIsSimulatedActive(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-stone-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-rose-500 peer-checked:after:translate-x-full peer-focus:outline-none" />
                </label>
              </div>

              {/* Custom Date Picker */}
              {isSimulatedActive && (
                <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                  <label className="block text-xs font-bold text-stone-700">
                    Simulated Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={simulatedDateTime}
                    onChange={(e) => setSimulatedDateTime(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 px-3 text-xs font-mono font-medium text-stone-900 outline-none transition focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  />

                  {/* Preset Buttons */}
                  <div className="pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1.5">
                      Fast Simulation Presets
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Monday 9:00 AM (Clinic Open)", offsetDays: 1, hour: 9 },
                        { label: "Friday 4:30 PM (Closing Soon)", offsetDays: 5, hour: 16 },
                        { label: "Sunday 11:00 PM (Quiet Hours)", offsetDays: 0, hour: 23 },
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + preset.offsetDays);
                            d.setHours(preset.hour, 0, 0, 0);
                            setSimulatedDateTime(d.toISOString().slice(0, 16));
                            setIsSimulatedActive(true);
                          }}
                          className="rounded-xl border border-stone-200 bg-stone-50 p-2 text-left text-[10px] font-semibold text-stone-700 hover:border-rose-300 hover:bg-rose-50/40 transition"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CAPACITY & WAVE ENGINE */}
          {activeTab === "capacity" && (
            <div className="space-y-5 animate-page-in">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
                  <label className="block text-xs font-bold text-stone-800">
                    Wave Batch Size (Candidates / Wave)
                  </label>
                  <p className="text-[11px] text-stone-500">Number of top-priority patients buzzed simultaneously per cancellation.</p>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={waveSize}
                    onChange={(e) => setWaveSize(Number(e.target.value))}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 px-3 text-sm font-mono font-bold text-stone-900 outline-none focus:border-rose-500 focus:bg-white"
                  />
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
                  <label className="block text-xs font-bold text-stone-800">
                    Wave Timeout (Minutes)
                  </label>
                  <p className="text-[11px] text-stone-500">Time window before slot escalates to the next tier of waitlisted candidates.</p>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={waveTimeoutMins}
                    onChange={(e) => setWaveTimeoutMins(Number(e.target.value))}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 px-3 text-sm font-mono font-bold text-stone-900 outline-none focus:border-rose-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: QUIET HOURS & AUTOMATION */}
          {activeTab === "automation" && (
            <div className="space-y-5 animate-page-in">
              <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50/50 p-4">
                <div>
                  <h4 className="text-xs font-bold text-stone-800">Autonomous Wave Recovery</h4>
                  <p className="text-[11px] text-stone-500">Automatically broadcast radar notifications when cancellations are detected.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={autoRecoveryEnabled}
                    onChange={(e) => setAutoRecoveryEnabled(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-stone-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-focus:outline-none" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
                  <label className="block text-xs font-bold text-stone-800">Quiet Hours Start</label>
                  <p className="text-[11px] text-stone-500">Hold notifications after this hour until next morning.</p>
                  <input
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 px-3 text-sm font-mono font-bold text-stone-900 outline-none focus:border-rose-500 focus:bg-white"
                  />
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
                  <label className="block text-xs font-bold text-stone-800">Quiet Hours End</label>
                  <p className="text-[11px] text-stone-500">Resume automatic dispatches at this morning hour.</p>
                  <input
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 px-3 text-sm font-mono font-bold text-stone-900 outline-none focus:border-rose-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SANDBOX DEMO CONTROLS */}
          {activeTab === "sandbox" && (
            <div className="space-y-4 animate-page-in">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-stone-900">Seed Sandbox Demo Schedule</h4>
                  <p className="text-[11px] text-stone-500">Instantly creates sample active appointments and waitlist entries for testing.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSeedSandbox}
                  disabled={loading}
                  className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white shadow hover:bg-stone-800 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-rose-400" />
                  <span>Seed Demo Data</span>
                </button>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-red-900">Purge / Clean Reset Database</h4>
                  <p className="text-[11px] text-red-700">Wipes all current appointments and standby queue entries to test zero-data empty states.</p>
                </div>
                <button
                  type="button"
                  onClick={handleResetSandbox}
                  disabled={loading}
                  className="rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 shadow-sm hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Purge Data</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-stone-100 px-6 py-4 bg-stone-50/80">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>State synchronized across all views</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveSettings()}
              disabled={saving}
              className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/20 hover:bg-rose-500 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save & Apply Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
