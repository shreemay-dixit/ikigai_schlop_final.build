"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  flexRender, getCoreRowModel, useReactTable, getSortedRowModel, SortingState, getFilteredRowModel, ColumnDef,
} from "@tanstack/react-table";
import { Calendar, Search, ArrowUpDown, CheckCircle2, XCircle, AlertCircle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Apt {
  id: string; patient_name: string; patient_phone: string; start_time: string;
  end_time: string; service_type: string; status: string; cancellation_reason?: string | null;
}

export default function AppointmentsPage() {
  const [data, setData] = useState<Apt[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/appointments");
      const json = await res.json();
      setData(json.data || []);
    } catch { toast.error("Failed to fetch appointments"); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCancel = async (id: string) => {
    setActionId(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", cancellation_reason: "Cancelled from dashboard" }),
      });
      const json = await res.json();
      if (json.success) { toast.success("Appointment cancelled — recovery wave dispatched"); fetchData(); }
      else toast.error(json.error || "Failed");
    } catch { toast.error("Network error"); }
    setActionId(null);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      confirmed: "bg-rose-50 text-rose-700 border-rose-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
      recovering: "bg-amber-50 text-amber-700 border-amber-200",
      recovered: "bg-emerald-50 text-emerald-700 border-emerald-200",
      completed: "bg-stone-50 text-stone-700 border-stone-200",
      no_show: "bg-stone-50 text-stone-500 border-stone-200",
    };
    const iconMap: Record<string, React.ReactNode> = {
      confirmed: <CheckCircle2 className="h-3 w-3" />,
      cancelled: <XCircle className="h-3 w-3" />,
      recovering: <AlertCircle className="h-3 w-3" />,
      recovered: <CheckCircle2 className="h-3 w-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${map[status] || map.completed}`}>
        {iconMap[status]}{status}
      </span>
    );
  };

  const columns: ColumnDef<Apt>[] = useMemo(() => [
    {
      accessorKey: "patient_name", header: ({ column }) => (
        <button className="flex items-center gap-1 font-semibold" onClick={() => column.toggleSorting()}>Patient <ArrowUpDown className="h-3 w-3" /></button>
      ),
      cell: ({ row }) => (
        <div><p className="font-semibold text-stone-900">{row.original.patient_name}</p><p className="text-[11px] text-stone-500 font-mono">{row.original.patient_phone}</p></div>
      ),
    },
    {
      accessorKey: "start_time", header: "Date & Time",
      cell: ({ row }) => {
        const d = new Date(row.original.start_time);
        return <div><p className="text-stone-800 font-medium">{d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p><p className="text-[11px] text-stone-500">{d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p></div>;
      },
    },
    { accessorKey: "service_type", header: "Service", cell: ({ row }) => <span className="text-stone-600">{row.original.service_type}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => statusBadge(row.original.status) },
    {
      id: "actions", header: "", cell: ({ row }) => {
        const apt = row.original;
        if (apt.status !== "confirmed") return null;
        return (
          <button onClick={() => handleCancel(apt.id)} disabled={actionId === apt.id}
            className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50">
            {actionId === apt.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Cancel"}
          </button>
        );
      },
    },
  ], [actionId]);

  const table = useReactTable({
    data, columns, getCoreRowModel: getCoreRowModel(), onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, globalFilter }, onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-stone-900"><Calendar className="h-6 w-6 text-rose-600" />Appointments</h1>
          <p className="text-sm text-stone-500">Manage schedule. Cancel to trigger automated recovery.</p>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -transtone-y-1/2 text-stone-400" />
          <input value={globalFilter ?? ""} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Search appointments…"
            className="w-full sm:w-64 rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50/60 text-stone-500">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id} className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider">{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>
              ))}
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{columns.map((_, j) => <td key={j} className="px-4 py-1.5"><div className="h-4 w-3/4 animate-pulse rounded bg-stone-100" /></td>)}</tr>
              )) : table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-stone-50/50 group">
                  {row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-1.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                </tr>
              )) : (
                <tr><td colSpan={columns.length} className="py-12 text-center text-stone-400">No appointments found. Seed demo data from the Overview page.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-stone-100 bg-stone-50/60 px-4 py-2.5 text-xs text-stone-500">{table.getRowModel().rows.length} records</div>
      </div>
    </div>
  );
}
