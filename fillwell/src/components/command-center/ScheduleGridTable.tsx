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
  MoreVertical,
  Search,
  XCircle,
  CheckCircle,
  Eye,
  Phone,
  Clock,
  User,
  Stethoscope,
} from "lucide-react";
import { Appointment } from "@/lib/types/database";
import {
  formatTimeOnly,
  formatPhone,
  getStatusBadgeConfig,
  cn,
} from "@/lib/utils";
import { toast } from "sonner";

interface ScheduleGridTableProps {
  appointments: Appointment[];
  isLoading?: boolean;
  onRefresh: () => void;
  onOpenInspector: (appointmentId: string) => void;
}

export function ScheduleGridTable({
  appointments,
  isLoading,
  onRefresh,
  onOpenInspector,
}: ScheduleGridTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [cancellingApt, setCancellingApt] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function updateStatus(
    id: string,
    status: string,
    reason?: string
  ) {
    try {
      setActionLoading(id);
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, cancellation_reason: reason }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      
      toast.success(
        status === "cancelled"
          ? "Appointment cancelled & automated recovery wave dispatched!"
          : `Appointment marked as ${status}.`
      );
      setCancellingApt(null);
      setCancelReason("");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to update appointment");
    } finally {
      setActionLoading(null);
    }
  }

  const columns = useMemo<ColumnDef<Appointment>[]>(
    () => [
      {
        accessorKey: "start_time",
        header: "Time",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-200">
            <Clock className="h-3.5 w-3.5 text-indigo-400" />
            {formatTimeOnly(row.original.start_time)}
          </div>
        ),
      },
      {
        accessorKey: "patient_name",
        header: "Patient",
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
        accessorKey: "provider.name",
        header: "Clinician",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
            <span>{row.original.provider?.name || "Unassigned"}</span>
          </div>
        ),
      },
      {
        accessorKey: "service_type",
        header: "Service",
        cell: ({ row }) => (
          <span className="text-xs text-slate-300">
            {row.original.service_type}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const cfg = getStatusBadgeConfig(row.original.status);
          return (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                  cfg.className
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dotColor)} />
                {cfg.label}
              </span>
              {row.original.recovered_by_patient_name && (
                <span className="text-[10px] text-indigo-400 font-mono">
                  &rarr; {row.original.recovered_by_patient_name}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const apt = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => onOpenInspector(apt.id)}
                title="Inspect AI Conversation & Tool Trail"
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>

              {apt.status === "confirmed" && (
                <>
                  <button
                    onClick={() => updateStatus(apt.id, "completed")}
                    disabled={actionLoading === apt.id}
                    title="Mark Completed"
                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-emerald-600/20 text-slate-300 hover:text-emerald-400 transition"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => setCancellingApt(apt)}
                    disabled={actionLoading === apt.id}
                    title="Cancel & Trigger Wave Recovery"
                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-600/20 text-slate-300 hover:text-rose-400 transition"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          );
        },
      },
    ],
    [actionLoading, onOpenInspector]
  );

  const table = useReactTable({
    data: appointments,
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
      {/* Search Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search patient, clinician, or service..."
            className="w-full rounded-lg bg-slate-950/80 border border-slate-800 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 transition"
          />
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Showing <strong>{table.getRowModel().rows.length}</strong> appointments today
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
                <tr
                  key={row.id}
                  className="hover:bg-slate-800/40 transition-colors group"
                >
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
                  No appointments match current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancellingApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-1">
              Cancel Appointment & Trigger Slot Recovery
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Cancelling <strong>{cancellingApt.patient_name}</strong> at{" "}
              {formatTimeOnly(cancellingApt.start_time)}. This will automatically dispatch Wave 1 SMS/WhatsApp notifications to top-priority waitlisted candidates.
            </p>

            <div className="mb-5">
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Cancellation Reason (Optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Patient tested positive / flight delayed / requested reschedule"
                rows={3}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCancellingApt(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
              >
                Keep Appointment
              </button>
              <button
                onClick={() => updateStatus(cancellingApt.id, "cancelled", cancelReason)}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 transition"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
