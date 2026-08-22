"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Bot,
  User,
  Terminal,
  Clock,
  ShieldCheck,
  Zap,
  MessageSquare,
} from "lucide-react";
import { AuditLog, Appointment } from "@/lib/types/database";
import { formatDateTime } from "@/lib/utils";

interface ConversationDrawerProps {
  appointmentId: string | null;
  onClose: () => void;
}

export function ConversationDrawer({
  appointmentId,
  onClose,
}: ConversationDrawerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"trail" | "json">("trail");

  useEffect(() => {
    if (!appointmentId) return;

    async function fetchLogs() {
      setLoading(true);
      try {
        const res = await fetch(`/api/audit?appointment_id=${appointmentId}`);
        const data = await res.json();
        if (data.success) {
          setLogs(data.data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [appointmentId]);

  if (!appointmentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-xl bg-slate-950 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                AI Audit Trail & Tool Call Inspector
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Appointment ID: {appointmentId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* View Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-900/30 px-5 pt-2">
          <button
            onClick={() => setActiveTab("trail")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === "trail"
                ? "border-indigo-500 text-indigo-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            Visual Message Trail
          </button>
          <button
            onClick={() => setActiveTab("json")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === "json"
                ? "border-indigo-500 text-indigo-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            Raw Tool Execution JSON
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-16 bg-slate-900 rounded-xl"></div>
              <div className="h-24 bg-slate-900 rounded-xl"></div>
              <div className="h-20 bg-slate-900 rounded-xl"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              No audit logs recorded for this slot yet.
            </div>
          ) : activeTab === "trail" ? (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                      {log.event_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>

                  {log.payload.raw_message && (
                    <div className="flex gap-2.5 items-start bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                      <Bot className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-200 leading-relaxed">
                        <strong className="text-cyan-300 block text-[11px] mb-0.5">
                          Outbound AI Dispatch:
                        </strong>
                        {log.payload.raw_message}
                      </div>
                    </div>
                  )}

                  {log.payload.atomic_lock_status && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      Atomic Lock Status:{" "}
                      <span className="text-emerald-400 font-bold">
                        {log.payload.atomic_lock_status}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-emerald-400 overflow-x-auto"
                >
                  <div className="text-slate-500 mb-1">
                    // Event: {log.event_type} at {log.created_at}
                  </div>
                  <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
