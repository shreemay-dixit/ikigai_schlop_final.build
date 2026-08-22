"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  flexRender, getCoreRowModel, useReactTable, getSortedRowModel, SortingState, getFilteredRowModel, ColumnDef,
} from "@tanstack/react-table";
import { Users, Search, ArrowUpDown, AlertTriangle, Clock, ShieldCheck, Loader2, Trash2, ArrowUp } from "lucide-react";
import { toast } from "sonner";

interface WL {
  id: string; patient_name: string; patient_phone: string; urgency_tier: string;
  priority_score: number; waitlist_joined_at: string; is_active: boolean; notes?: string | null;
}

export default function WaitlistPage() {
  const [data, setData] = useState<WL[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id: "priority_score", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist");
      const json = await res.json();
      setData(json.data || []);
    } catch { toast.error("Failed to fetch waitlist"); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleBump = async (id: string) => {
    setActionId(id);
    try {
      await fetch(`/api/waitlist/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bump_priority" }) });
      toast.success("Priority bumped");
      fetchData();
    } catch { toast.error("Failed to bump"); }
    setActionId(null);
  };

  const handleDelete = async (id: string) => {
    setActionId(id);
    try {
      await fetch(`/api/waitlist/${id}`, { method: "DELETE" });
      toast.success("Entry removed");
      fetchData();
    } catch { toast.error("Failed to remove"); }
    setActionId(null);
  };

  const urgencyBadge = (tier: string) => {
    const map: Record<string, { cls: string; icon: React.ReactNode }> = {
      urgent: { cls: "bg-red-50 text-red-700 border-red-200", icon: <AlertTriangle className="h-3 w-3" /> },
      moderate: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock className="h-3 w-3" /> },
      routine: { cls: "bg-blue-50 text-blue-700 border-blue-200", icon: <ShieldCheck className="h-3 w-3" /> },
    };
    const m = map[tier] || map.routine;
    return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${m.cls}`}>{m.icon}{tier}</span>;
  };

  const columns: ColumnDef<WL>[] = useMemo(() => [
    {
      accessorKey: "patient_name",
      header: ({ column }) => <button className="flex items-center gap-1 font-semibold" onClick={() => column.toggleSorting()}>Patient <ArrowUpDown className="h-3 w-3" /></button>,
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-slate-900">{row.original.patient_name}
            {!row.original.is_active && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 uppercase border border-slate-200">Inactive</span>}
          </p>
          <p className="text-[11px] text-slate-500 font-mono">{row.original.patient_phone}</p>
        </div>
      ),
    },
    { accessorKey: "urgency_tier", header: "AI Triage", cell: ({ row }) => urgencyBadge(row.original.urgency_tier) },
    {
      accessorKey: "priority_score",
      header: ({ column }) => <button className="flex items-center gap-1 font-semibold" onClick={() => column.toggleSorting()}>Score <ArrowUpDown className="h-3 w-3" /></button>,
      cell: ({ row }) => <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">{row.original.priority_score}/5</span>,
    },
    {
      accessorKey: "waitlist_joined_at", header: "Joined",
      cell: ({ row }) => {
        const d = new Date(row.original.waitlist_joined_at);
        return <span className="text-xs text-slate-600">{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} {d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>;
      },
    },
    { accessorKey: "notes", header: "Notes", cell: ({ row }) => <span className="line-clamp-1 max-w-[180px] text-xs text-slate-500" title={row.original.notes || ""}>{row.original.notes || "—"}</span> },
    {
      id: "actions", header: "",
      cell: ({ row }) => {
        if (!row.original.is_active) return null;
        const id = row.original.id;
        return (
          <div className="flex items-center gap-1">
            <button onClick={() => handleBump(id)} disabled={actionId === id} title="Bump priority"
              className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50">
              {actionId === id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => handleDelete(id)} disabled={actionId === id} title="Remove"
              className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
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
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900"><Users className="h-6 w-6 text-indigo-600" />Priority Waitlist</h1>
          <p className="text-sm text-slate-500">Patients ranked by Gemini AI clinical triage urgency.</p>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={globalFilter ?? ""} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Search waitlist…"
            className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-slate-500">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id} className="px-4 py-3 text-left font-semibold">{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{columns.map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" /></td>)}</tr>
              )) : table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
                <tr key={row.id} className={`transition-colors ${row.original.is_active ? "hover:bg-slate-50/50" : "opacity-50"}`}>
                  {row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                </tr>
              )) : (
                <tr><td colSpan={columns.length} className="py-12 text-center text-slate-400">No candidates on the waitlist.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-500">{table.getRowModel().rows.length} candidates</div>
      </div>
    </div>
  );
}
