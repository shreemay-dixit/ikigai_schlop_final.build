"use client";

import React from "react";
import {
  FileText, Zap, Radio, CheckCircle2, XCircle, AlertTriangle,
  Clock, ShieldCheck, RefreshCw
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export interface AuditItem {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  payload: any;
  created_at: string;
}

interface AuditFeedProps {
  logs: AuditItem[];
  loading: boolean;
  onRefresh: () => void;
}

export function AuditFeed({ logs, loading, onRefresh }: AuditFeedProps) {
  const getEventMeta = (eventType: string) => {
    switch (eventType) {
      case "slot_atomic_locked_claimed":
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
          bgColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
          title: "Atomic Lock Claimed",
        };
      case "cancellation_detected":
      case "slot_cancelled":
        return {
          icon: <XCircle className="h-3.5 w-3.5 text-rose-600" />,
          bgColor: "bg-rose-50 text-rose-700 border-rose-200",
          title: "Slot Cancelled",
        };
      case "wave_dispatched":
      case "recovery_wave_dispatched":
        return {
          icon: <Zap className="h-3.5 w-3.5 text-amber-600" />,
          bgColor: "bg-amber-50 text-amber-700 border-amber-200",
          title: "Recovery Wave Dispatched",
        };
      case "waitlist_joined":
      case "patient_waitlist_registered":
        return {
          icon: <Radio className="h-3.5 w-3.5 text-blue-600" />,
          bgColor: "bg-blue-50 text-blue-700 border-blue-200",
          title: "Patient Joined Radar",
        };
      default:
        return {
          icon: <FileText className="h-3.5 w-3.5 text-stone-600" />,
          bgColor: "bg-stone-50 text-stone-700 border-stone-200",
          title: eventType.replace(/_/g, " ").toUpperCase(),
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100 shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 leading-none">System Audit Trail</h2>
            <p className="text-xs text-stone-500 mt-1">Immutable transaction ledger and concurrency log stream.</p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Log Feed */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        {loading && logs.length === 0 ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-stone-100" />
            ))}
          </div>
        ) : logs.length > 0 ? (
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {logs.map((log) => {
              const meta = getEventMeta(log.event_type);
              const payloadStr =
                typeof log.payload === "object"
                  ? JSON.stringify(log.payload, null, 1).replace(/[{}\"]/g, " ")
                  : String(log.payload);

              return (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-stone-100 bg-stone-50/50 p-3 text-xs transition-colors hover:bg-stone-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm border border-stone-200">
                      {meta.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">{meta.title}</span>
                        <span className="font-mono text-[10px] text-stone-400">
                          {log.entity_type}#{log.entity_id.slice(-6)}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 truncate max-w-md font-mono mt-0.5">
                        {payloadStr}
                      </p>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-stone-400 self-end sm:self-center shrink-0">
                    {new Date(log.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No Audit Logs Recorded"
            description="System activity such as patient registrations, cancellations, and atomic locks will stream here in real-time."
          />
        )}
      </div>
    </div>
  );
}
