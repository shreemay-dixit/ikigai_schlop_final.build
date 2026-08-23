"use client";

import React, { useState } from "react";
import {
  Users, Clock, AlertTriangle, ShieldCheck, ArrowUp,
  Trash2, Loader2, Sparkles, Plus, RefreshCw, Radio, Check,
  Ticket
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";

export interface WaitlistItem {
  id: string;
  patient_name: string;
  patient_phone: string;
  urgency_tier: "routine" | "moderate" | "urgent";
  priority_score: number;
  token_number?: string;
  estimated_wait_mins?: number;
  queue_position?: number;
  waitlist_joined_at: string;
  is_active: boolean;
  notes?: string | null;
}

interface WaitlistPanelProps {
  waitlist: WaitlistItem[];
  loading: boolean;
  onRefresh: () => void;
}

export function WaitlistPanel({ waitlist, loading, onRefresh }: WaitlistPanelProps) {
  const [actionId, setActionId] = useState<string | null>(null);

  const handleBumpPriority = async (id: string) => {
    if (actionId === id) return;
    setActionId(id);

    try {
      const res = await fetch(`/api/waitlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bump_priority" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to bump priority");

      toast.success("Priority bumped (+1 score)!");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to bump priority");
    } finally {
      setActionId(null);
    }
  };

  const handleAdmitDone = async (item: WaitlistItem) => {
    if (actionId === item.id) return;
    setActionId(item.id);

    try {
      const res = await fetch(`/api/waitlist/${item.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to process entry");

      toast.success(`Patient admitted & marked done! 🎉`, {
        description: `${item.patient_name} (${item.token_number || "WL-201"})`,
      });
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to process entry");
    } finally {
      setActionId(null);
    }
  };

  const handleRemove = async (id: string) => {
    if (actionId === id) return;
    setActionId(id);

    try {
      const res = await fetch(`/api/waitlist/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to remove entry");

      toast.success("Patient removed from standby queue");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove entry");
    } finally {
      setActionId(null);
    }
  };

  const urgencyBadge = (tier: WaitlistItem["urgency_tier"], score: number) => {
    switch (tier) {
      case "urgent":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-red-700">
            <AlertTriangle className="h-3 w-3 text-red-600" /> Urgent ({score}/5)
          </span>
        );
      case "moderate":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-700">
            <Clock className="h-3 w-3 text-amber-600" /> Moderate ({score}/5)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-blue-700">
            <ShieldCheck className="h-3 w-3 text-blue-600" /> Routine ({score}/5)
          </span>
        );
    }
  };

  const activeWaitlist = waitlist.filter((w) => w.is_active);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 leading-none">Standby Radar Waitlist</h2>
            <p className="text-xs text-stone-500 mt-1">Live queue of prioritized standby patients with tokens and dynamic wait estimates.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/portal"
            target="_blank"
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-500 transition"
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Open Mobile Portal &rarr;</span>
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-stone-200 bg-stone-50/70 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Token & Patient</th>
                <th className="px-4 py-3">Urgency & Score</th>
                <th className="px-4 py-3">Estimated Wait</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading && waitlist.length === 0 ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-5 py-4">
                      <div className="h-5 w-full animate-pulse rounded-lg bg-stone-100" />
                    </td>
                  </tr>
                ))
              ) : activeWaitlist.length > 0 ? (
                activeWaitlist.map((item) => {
                  const isActing = actionId === item.id;
                  const minsElapsed = Math.max(
                    0,
                    Math.round((Date.now() - new Date(item.waitlist_joined_at).getTime()) / 60000)
                  );

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-stone-50/80">
                      {/* Token & Patient */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex flex-col items-center justify-center rounded-xl bg-amber-500 text-stone-950 font-mono font-black text-[10px] px-2 py-1 shadow-sm min-w-[54px]">
                            <span className="text-[8px] uppercase tracking-tight text-stone-900 opacity-80">TOKEN</span>
                            <span>{item.token_number || "WL-201"}</span>
                          </div>
                          <div>
                            <p className="font-bold text-stone-900">{item.patient_name}</p>
                            <p className="text-[11px] font-mono text-stone-500">{item.patient_phone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Urgency */}
                      <td className="px-4 py-3.5">
                        {urgencyBadge(item.urgency_tier, item.priority_score)}
                      </td>

                      {/* Dynamic Wait Estimate */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-mono font-bold text-emerald-800">
                            <Clock className="h-3 w-3 text-emerald-600" />
                            <span>
                              {item.estimated_wait_mins && item.estimated_wait_mins <= 2
                                ? "Next in Line"
                                : `~${item.estimated_wait_mins || 6} mins`}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono text-stone-400">
                            Position #{item.queue_position || 1} ({minsElapsed}m elapsed)
                          </p>
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3.5 text-stone-500 truncate max-w-xs">
                        {item.notes || "Registered via Standby Radar"}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Done / Admit Button */}
                          <button
                            onClick={() => handleAdmitDone(item)}
                            disabled={isActing}
                            title="Mark patient admitted & served"
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
                          >
                            {isActing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-3 w-3" /> Done
                              </>
                            )}
                          </button>

                          {/* Bump Priority */}
                          <button
                            onClick={() => handleBumpPriority(item.id)}
                            disabled={isActing}
                            title="Bump priority score"
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition disabled:opacity-50"
                          >
                            <ArrowUp className="h-3 w-3" /> Bump
                          </button>

                          {/* Remove */}
                          <button
                            onClick={() => handleRemove(item.id)}
                            disabled={isActing}
                            title="Remove from queue"
                            className="rounded-lg border border-stone-200 bg-white p-1 text-stone-400 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-8">
                    <EmptyState
                      icon={Users}
                      title="Standby Queue is Empty"
                      description="No patients are currently waiting on the standby radar. Patients can onboard from the mobile portal."
                      action={
                        <Link
                          href="/portal"
                          target="_blank"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-500 transition"
                        >
                          <Radio className="h-3.5 w-3.5" /> Onboard Test Patient &rarr;
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
