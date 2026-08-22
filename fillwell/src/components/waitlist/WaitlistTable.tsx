"use client";

import React, { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import {
  Search,
  ArrowUpCircle,
  Trash2,
  Phone,
  Calendar,
  Clock,
  AlertCircle,
  Send,
} from "lucide-react";
import { WaitlistEntry } from "@/lib/types/database";
import {
  calculateWaitDays,
  formatPhone,
  getUrgencyBadgeConfig,
  cn,
} from "@/lib/utils";
import { toast } from "sonner";

interface WaitlistTableProps {
  entries: WaitlistEntry[];
  isLoading?: boolean;
  onRefresh: () => void;
}

export function WaitlistTable({
  entries,
  isLoading,
  onRefresh,
}: WaitlistTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function bumpPriority(id: string) {
    try {
      setActionLoading(id);
      const res = await fetch(`/api/waitlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bump_priority" }),
      });
      if (!res.ok) throw new Error("Failed to bump priority");
      toast.success("Patient priority elevated in recovery queue!");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to elevate priority");
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Are you sure you want to remove this patient from the waitlist?")) return;
    try {
      setActionLoading(id);
      const res = await fetch(`/api/waitlist/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove waitlist entry");
      toast.success("Patient removed from waitlist.");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove entry");
    } finally {
      setActionLoading(null);
    }
  }

  const columns = useMemo<ColumnDef<WaitlistEntry>[]>(
    () => [
      {
        accessorKey: "priority_score",
        header: "Score",
        cell: ({ row }) => (
          <div className="flex items-center gap-1 font-mono font-bold text-xs text-indigo-400">
            #{row.original.priority_score}
          </div>
        ),
      },
      {
        accessorKey: "patient_name",
        header: "Patient Name",
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-slate-100 text-xs">
              {row.original.patient_name}
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3 text-slate-500" />
              {formatPhone(row.original.patient_phone)}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "urgency_tier",
        header: "Urgency Tier",
        cell: ({ row }) => {
          const cfg = getUrgencyBadgeConfig(row.original.urgency_tier);
          return (
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] border uppercase tracking-wider",
                cfg.className
              )}
            >
              {cfg.label}
            </span>
          );
        },
      },
      {
        accessorKey: "waitlist_joined_at",
        header: "Wait Time",
        cell: ({ row }) => {
          const days = calculateWaitDays(row.original.waitlist_joined_at);
          return (
            <div className="text-xs text-slate-300 font-mono">
              <strong>{days}</strong> days waiting
            </div>
          );
        },
      },
      {
        accessorKey: "preferred_time_windows",
        header: "Availability Window",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.preferred_time_windows.map((w) => (
              <span
                key={w}
                className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-medium capitalize"
              >
                {w}
              </span>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "provider.name",
        header: "Assigned Clinician",
        cell: ({ row }) => (
          <span className="text-xs text-slate-300">
            {row.original.provider?.name || "Any Available"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => bumpPriority(entry.id)}
                disabled={actionLoading === entry.id}
                title="Manual Priority Bump"
                className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-medium flex items-center gap-1 transition"
              >
                <ArrowUpCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[11px]">Bump</span>
              </button>

              <button
                onClick={() => deleteEntry(entry.id)}
                disabled={actionLoading === entry.id}
                title="Remove from Waitlist"
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        },
      },
    ],
    [actionLoading]
  );

  const table = useReactTable({
    data: entries,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
      {/* Search Bar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search patient, phone, urgency..."
            className="w-full rounded-lg bg-slate-950/80 border border-slate-800 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 transition"
          />
        </div>
        <div className="text-xs text-slate-400 font-mono">
          <strong>{entries.length}</strong> waitlisted candidates ready for slot recovery
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-800 bg-slate-950/40">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-3 px-4 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-3 px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="text-center py-10 text-slate-500">
                  No waitlist entries found. Add patients to start automated recovery.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
