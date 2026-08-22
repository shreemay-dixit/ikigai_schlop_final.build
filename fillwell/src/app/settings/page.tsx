"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Settings, RotateCcw } from "lucide-react";
import { ClinicSettings, Provider } from "@/lib/types/database";
import { IntegrationTelemetryCard } from "@/components/settings/IntegrationTelemetryCard";
import { AutomationConfigCard } from "@/components/settings/AutomationConfigCard";
import { ProviderManagementCard } from "@/components/settings/ProviderManagementCard";
import { TableSkeleton } from "@/components/ui/common/TableSkeleton";
import { ErrorState } from "@/components/ui/common/ErrorState";

export default function ClinicSettingsPage() {
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [settRes, provRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/providers"),
      ]);

      const [settData, provData] = await Promise.all([
        settRes.json(),
        provRes.json(),
      ]);

      if (!settData.success) throw new Error(settData.error || "Failed to load settings");
      if (!provData.success) throw new Error(provData.error || "Failed to load providers");

      setSettings(settData.data || null);
      setProviders(provData.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load clinic settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={4} cols={2} />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <span>Clinic Settings & Telemetry</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              ENTERPRISE CONFIG
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure quiet hours, wave candidate dispatch counts, carrier webhooks, and clinician schedules.
          </p>
        </div>

        <button
          onClick={() => fetchData()}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Refresh Configuration
        </button>
      </div>

      {/* Integration Telemetry Card */}
      <IntegrationTelemetryCard settings={settings} />

      {/* Automation Config Card */}
      <AutomationConfigCard settings={settings} onRefresh={fetchData} />

      {/* Provider Management Card */}
      <ProviderManagementCard providers={providers} onRefresh={fetchData} />
    </div>
  );
}
