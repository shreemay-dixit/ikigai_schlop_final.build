"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Bot,
  Terminal,
  ShieldCheck,
  RotateCcw,
  Zap,
  Activity,
} from "lucide-react";
import { AuditLog } from "@/lib/types/database";
import { formatDateTime } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/common/TableSkeleton";
import { EmptyState } from "@/components/ui/common/EmptyState";
import { ErrorState } from "@/components/ui/common/ErrorState";

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const fetchLogs = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/audit");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load audit logs");
      setLogs(data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load audit trail");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    if (filterType === "all") return true;
    return log.event_type.includes(filterType);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <span>Live Audit Trail & AI Inspector</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              IMMUTABLE LOGS
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time trace of AI slot detection, SMS/WhatsApp conversation trails, and atomic locking state.
          </p>
        </div>

        <button
          onClick={() => fetchLogs()}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Refresh Logs
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "all", label: "All Audit Events" },
          { id: "wave", label: "Wave Dispatches" },
          { id: "cancellation", label: "Cancellations" },
          { id: "locked", label: "Atomic Slot Locks" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
              filterType === tab.id
                ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                : "bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Log Feed */}
      {loading ? (
        <div className="space-y-4">
          <TableSkeleton rows={4} cols={4} />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={fetchLogs} />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          title="No audit events found"
          description="Audit entries will populate automatically as cancellations and AI wave dispatches occur."
        />
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl space-y-3 hover:border-slate-700 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                    <Activity className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-100 uppercase">
                    {log.event_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                    Entity: {log.entity_type}
                  </span>
                </div>

                <span className="text-[11px] text-slate-400 font-mono">
                  {formatDateTime(log.created_at)}
                </span>
              </div>

              {/* Message Payload */}
              {log.payload.raw_message && (
                <div className="flex gap-3 items-start bg-slate-950 p-3.5 rounded-lg border border-slate-800/80">
                  <Bot className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-200">
                    <span className="text-cyan-300 font-semibold block text-[11px] mb-0.5">
                      Outbound AI Dispatch Notification:
                    </span>
                    {log.payload.raw_message}
                  </div>
                </div>
              )}

              {/* Structured Details JSON */}
              <div className="rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-emerald-400 border border-slate-800/80 overflow-x-auto">
                <pre>{JSON.stringify(log.payload, null, 2)}</pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
