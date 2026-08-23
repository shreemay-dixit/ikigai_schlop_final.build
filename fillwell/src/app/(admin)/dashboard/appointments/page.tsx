"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  flexRender, getCoreRowModel, useReactTable, getSortedRowModel,
  SortingState, getFilteredRowModel, ColumnDef,
} from "@tanstack/react-table";
import {
  Calendar, Search, ArrowUpDown, CheckCircle2, XCircle, AlertCircle,
  Loader2, Radio, Clock, ShieldCheck, X, FileText, ChevronRight,
  User, Phone, Sparkles, RefreshCw, Zap
} from "lucide-react";
import { toast } from "sonner";

interface Apt {
  id: string;
  patient_name: string;
  patient_phone: string;
  start_time: string;
  end_time: string;
  service_type: string;
  status: "confirmed" | "cancelled" | "recovering" | "recovered" | "completed" | "no_show";
  cancellation_reason?: string | null;
  recovered_by_patient_name?: string | null;
  recovered_by_patient_phone?: string | null;
  recovered_at?: string | null;
}

export default function AppointmentsPage() {
  const [data, setData] = useState<Apt[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  
  // Drawer / Sheet state for Recovery Audit
  const [selectedApt, setSelectedApt] = useState<Apt | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/appointments");
      const json = await res.json();
      setData(json.data || []);
    } catch {
      if (!silent) toast.error("Failed to fetch appointments");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Live polling for instant updates when mobile triage cancels or recovers slots
    const interval = setInterval(() => {
      fetchData(true);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Audit Logs when opening the drawer
  const openAuditDrawer = async (apt: Apt) => {
    setSelectedApt(apt);
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/audit?appointment_id=${apt.id}`);
      const json = await res.json();
      setAuditLogs(json.data || []);
    } catch {
      toast.error("Failed to fetch audit timeline");
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleCancel = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActionId(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          cancellation_reason: "Manual cancellation from Operator Schedule",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Appointment cancelled — Recovery Wave dispatched instantly!");
        fetchData(true);
      } else {
        toast.error(json.error || "Cancellation failed");
      }
    } catch {
      toast.error("Network error while cancelling appointment");
    } finally {
      setActionId(null);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
            <CheckCircle2 className="h-3 w-3 text-rose-600" /> Confirmed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
            <XCircle className="h-3 w-3 text-red-600" /> Cancelled
          </span>
        );
      case "recovering":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 animate-pulse">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Dispatching Wave…
          </span>
        );
      case "recovered":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Recovered
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-bold text-stone-600">
            {status}
          </span>
        );
    }
  };

  const columns: ColumnDef<Apt>[] = useMemo(
    () => [
      {
        accessorKey: "patient_name",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 font-bold uppercase tracking-wider text-xs"
            onClick={() => column.toggleSorting()}
          >
            Patient <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div>
            <p className="font-bold text-stone-900">{row.original.patient_name}</p>
            <p className="text-[11px] font-mono text-stone-500">{row.original.patient_phone}</p>
          </div>
        ),
      },
      {
        accessorKey: "start_time",
        header: "Schedule Time",
        cell: ({ row }) => {
          const d = new Date(row.original.start_time);
          return (
            <div>
              <p className="font-bold text-stone-800">
                {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
              <p className="text-[11px] font-mono text-stone-500">
                {d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "service_type",
        header: "Service",
        cell: ({ row }) => (
          <span className="font-medium text-stone-700">{row.original.service_type}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => statusBadge(row.original.status),
      },
      {
        id: "actions",
        header: "Audit / Actions",
        cell: ({ row }) => {
          const apt = row.original;
          return (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => openAuditDrawer(apt)}
                className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-bold text-stone-700 transition hover:bg-stone-100 shadow-sm"
              >
                <FileText className="h-3 w-3 text-rose-600" /> Audit
              </button>
              {apt.status === "confirmed" && (
                <button
                  onClick={(e) => handleCancel(apt.id, e)}
                  disabled={actionId === apt.id}
                  className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50 shadow-sm flex items-center gap-1"
                >
                  {actionId === apt.id ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Cancelling…
                    </>
                  ) : (
                    "Cancel Slot"
                  )}
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [actionId]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <div className="max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-stone-900">
            <Calendar className="h-6 w-6 text-rose-600" /> Live Schedule & Monitoring
          </h1>
          <p className="text-sm font-medium text-stone-500">
            Real-time synchronization with patient NLP mobile triage & automated recovery waves.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search schedule…"
              className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3 text-xs text-stone-900 shadow-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
          </div>
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 shadow-sm transition hover:bg-stone-50 hover:text-stone-900 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Table Canvas ── */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50/70 text-stone-500">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider"
                    >
                      {h.isPlaceholder
                        ? null
                        : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-stone-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openAuditDrawer(row.original)}
                    className="cursor-pointer transition-colors hover:bg-rose-50/30 group"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                /* Empty State (Strict UX Rule 3) */
                <tr>
                  <td colSpan={columns.length} className="py-16 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 mb-3 shadow-inner">
                      <Calendar className="h-7 w-7" />
                    </div>
                    <h3 className="text-base font-bold text-stone-800">No Appointments Scheduled</h3>
                    <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
                      There are currently no bookings in the system. Seed test appointments to test the live recovery waves.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-2.5 text-xs font-medium text-stone-500 flex justify-between">
          <span>{table.getRowModel().rows.length} total scheduled slots</span>
          <span className="font-mono text-stone-400">Auto-refresh active (2s)</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PART 2: THE RECOVERY AUDIT DRAWER (SLIDE-OVER SHEET)
      ══════════════════════════════════════════════════════════════════ */}
      {selectedApt && (
        <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40 backdrop-blur-xs animate-page-in">
          {/* Backdrop click to close */}
          <div className="flex-1" onClick={() => setSelectedApt(null)} />

          {/* Drawer Canvas */}
          <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full overflow-hidden border-l border-stone-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-stone-200 p-6 bg-stone-50/60">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-stone-900">Recovery Audit Sheet</h2>
                  <p className="text-xs font-mono text-stone-500">ID: {selectedApt.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedApt(null)}
                className="rounded-full p-2 text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Appointment Summary Card */}
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Slot Information
                  </span>
                  {statusBadge(selectedApt.status)}
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                  <div>
                    <span className="text-stone-500">Original Patient:</span>
                    <p className="font-bold text-stone-900">{selectedApt.patient_name}</p>
                    <p className="text-[11px] font-mono text-stone-500">{selectedApt.patient_phone}</p>
                  </div>
                  <div>
                    <span className="text-stone-500">Service & Time:</span>
                    <p className="font-bold text-stone-900">{selectedApt.service_type}</p>
                    <p className="text-[11px] font-mono text-stone-600">
                      {new Date(selectedApt.start_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      Today
                    </p>
                  </div>
                </div>

                {selectedApt.recovered_by_patient_name && (
                  <div className="border-t border-stone-200 pt-3 text-xs text-emerald-800 bg-emerald-50/70 p-3 rounded-xl">
                    <p className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Recovered by: {selectedApt.recovered_by_patient_name}
                    </p>
                    <p className="text-[11px] font-mono text-emerald-700 mt-0.5">
                      Phone: {selectedApt.recovered_by_patient_phone || "—"}
                    </p>
                  </div>
                )}
              </div>

              {/* NLP Triage & Reason */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-rose-600" /> NLP Triage & Cancellation Reason
                </h3>
                <div className="rounded-xl border border-stone-200 bg-white p-4 text-xs text-stone-700 leading-relaxed shadow-sm">
                  <p className="font-medium">
                    {selectedApt.cancellation_reason || "No explicit cancellation reason recorded."}
                  </p>
                </div>
              </div>

              {/* Recovery Wave Timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" /> Recovery Wave Timeline & Buzzer Alerts
                </h3>

                {loadingLogs ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-14 animate-pulse rounded-xl bg-stone-100" />
                    ))}
                  </div>
                ) : auditLogs.length ? (
                  <div className="space-y-3 relative before:absolute before:inset-y-2 before:left-3.5 before:w-[2px] before:bg-stone-200">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="relative flex gap-3.5 items-start">
                        <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-white shadow-sm">
                          <Radio className="h-3 w-3" />
                        </div>
                        <div className="flex-1 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-900">
                              {log.event_type.replace(/_/g, " ").toUpperCase()}
                            </span>
                            <span className="font-mono text-[10px] text-stone-400">
                              {new Date(log.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          {log.payload?.candidates_targeted && (
                            <p className="text-[11px] text-stone-600">
                              Targeted candidates:{" "}
                              <strong className="text-stone-800">
                                {log.payload.candidates_targeted.join(", ")}
                              </strong>
                            </p>
                          )}
                          {log.payload?.claimed_by && (
                            <p className="text-[11px] text-emerald-700 font-bold">
                              Claimed by: {log.payload.claimed_by} ({log.payload.channel || "mobile"})
                            </p>
                          )}
                          {log.payload?.raw_message && (
                            <p className="text-[11px] italic text-stone-500 mt-1">
                              "{log.payload.raw_message}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs text-stone-400">
                    No recovery wave logs recorded for this appointment.
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="border-t border-stone-200 p-4 bg-stone-50 flex justify-end">
              <button
                onClick={() => setSelectedApt(null)}
                className="rounded-xl bg-stone-900 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-stone-800 transition"
              >
                Close Audit Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
