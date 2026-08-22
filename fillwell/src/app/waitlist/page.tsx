"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UserPlus, Users, AlertCircle, Clock, RotateCcw } from "lucide-react";
import { WaitlistEntry, Provider } from "@/lib/types/database";
import { WaitlistTable } from "@/components/waitlist/WaitlistTable";
import { AddWaitlistModal } from "@/components/waitlist/AddWaitlistModal";
import { TableSkeleton } from "@/components/ui/common/TableSkeleton";
import { EmptyState } from "@/components/ui/common/EmptyState";
import { ErrorState } from "@/components/ui/common/ErrorState";

export default function WaitlistManagementPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [waitRes, provRes] = await Promise.all([
        fetch("/api/waitlist"),
        fetch("/api/providers"),
      ]);

      const [waitData, provData] = await Promise.all([
        waitRes.json(),
        provRes.json(),
      ]);

      if (!waitData.success) throw new Error(waitData.error || "Failed to load waitlist");
      if (!provData.success) throw new Error(provData.error || "Failed to load providers");

      setEntries(waitData.data || []);
      setProviders(provData.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load waitlist data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const urgentCount = entries.filter((e) => e.urgency_tier === "urgent").length;
  const moderateCount = entries.filter((e) => e.urgency_tier === "moderate").length;
  const routineCount = entries.filter((e) => e.urgency_tier === "routine").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <span>Waitlist & Priority Matrix</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              SLOT RECOVERY POOL
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Prioritized candidate queue for automated wave SMS/WhatsApp slot filling.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Refresh
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition"
          >
            <UserPlus className="h-4 w-4" />
            Add Patient to Waitlist
          </button>
        </div>
      </div>

      {/* Priority Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg">
          <span className="text-xs text-slate-400 font-medium">Total Pool</span>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-1">
            {entries.length}
          </div>
          <span className="text-[11px] text-slate-500">Waitlisted patients</span>
        </div>

        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 shadow-lg">
          <span className="text-xs text-rose-300 font-medium">Urgent Priority (P5)</span>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
            {urgentCount}
          </div>
          <span className="text-[11px] text-rose-400/70">Wave 1 first dispatch</span>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-lg">
          <span className="text-xs text-amber-300 font-medium">Moderate (P3)</span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {moderateCount}
          </div>
          <span className="text-[11px] text-amber-400/70">Standard priority</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg">
          <span className="text-xs text-slate-400 font-medium">Routine (P1)</span>
          <div className="text-2xl font-bold font-mono text-slate-300 mt-1">
            {routineCount}
          </div>
          <span className="text-[11px] text-slate-500">General checkups</span>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchData} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Waitlist is empty"
          description="Add patients to the waitlist to enable autonomous slot filling when cancellations occur."
          actionLabel="Add Patient to Waitlist"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <WaitlistTable
          entries={entries}
          isLoading={loading}
          onRefresh={fetchData}
        />
      )}

      {/* Add Patient Modal */}
      <AddWaitlistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        providers={providers}
        onSuccess={fetchData}
      />
    </div>
  );
}
