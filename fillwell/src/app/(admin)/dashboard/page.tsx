"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  flexRender, getCoreRowModel, useReactTable, getSortedRowModel, SortingState, getFilteredRowModel, ColumnDef,
} from "@tanstack/react-table";
import { Users, Search, ArrowUpDown, AlertTriangle, Clock, ShieldCheck, Loader2, Trash2, ArrowUp, Activity, FileText, Zap } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface WL {
  id: string; patient_name: string; patient_phone: string; urgency_tier: string;
  priority_score: number; waitlist_joined_at: string; is_active: boolean; notes?: string | null;
}

export default function QueueCommandCenter() {
  const [data, setData] = useState<WL[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id: "priority_score", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [waitRes, auditRes] = await Promise.all([
        fetch("/api/waitlist").then((r) => r.json()),
        fetch("/api/audit").then((r) => r.json()),
      ]);
      setData(waitRes.data || []);
      setLogs((auditRes.data || []).reverse().slice(0, 8));
    } catch { toast.error("Failed to fetch queue"); }
    setLoading(false);
  };

  useEffect(() => { 
    fetchData(); 
    const interval = setInterval(fetchData, 10000); // Live poll every 10s
    return () => clearInterval(interval);
  }, []);

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
    const map: Record<string, { cls: string; icon: React.ReactNode; tooltip: string }> = {
      urgent: { cls: "bg-red-50 text-red-700 border-red-200", icon: <AlertTriangle className="h-3 w-3" />, tooltip: "AI assessed as high severity. Immediate action recommended." },
      moderate: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock className="h-3 w-3" />, tooltip: "AI assessed as moderate severity. Escalate if symptoms worsen." },
      routine: { cls: "bg-blue-50 text-blue-700 border-blue-200", icon: <ShieldCheck className="h-3 w-3" />, tooltip: "Routine checkup or minor complaint." },
    };
    const m = map[tier] || map.routine;
    return (
      <div className="group relative inline-block">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase cursor-help ${m.cls}`}>{m.icon}{tier}</span>
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 opacity-0 transition-opacity group-hover:opacity-100 bg-slate-900 text-white text-[10px] rounded p-2 text-center shadow-lg z-50">
          {m.tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      </div>
    );
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
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">{row.original.priority_score}/5</span>
          {row.original.priority_score >= 4 && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
        </div>
      ),
    },
    {
      accessorKey: "waitlist_joined_at", header: "Wait Time",
      cell: ({ row }) => {
        const mins = Math.max(0, Math.round((Date.now() - new Date(row.original.waitlist_joined_at).getTime()) / 60000));
        return <span className={`text-xs font-mono font-bold ${mins > 30 ? "text-red-600" : "text-slate-600"}`}>{mins}m elapsed</span>;
      },
    },
    { accessorKey: "notes", header: "Notes", cell: ({ row }) => <span className="line-clamp-1 max-w-[120px] text-[11px] text-slate-500 cursor-help" title={row.original.notes || ""}>{row.original.notes || "—"}</span> },
    {
      id: "actions", header: "",
      cell: ({ row }) => {
        if (!row.original.is_active) return null;
        const id = row.original.id;
        return (
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => handleBump(id)} disabled={actionId === id} title="Bump priority"
              className="rounded-md border border-indigo-200 p-1.5 text-indigo-600 transition hover:bg-indigo-600 hover:text-white disabled:opacity-50 shadow-sm bg-indigo-50">
              {actionId === id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => handleDelete(id)} disabled={actionId === id} title="Remove"
              className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-50 shadow-sm bg-white">
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

  // Calculate Insights
  const activeQueue = data.filter(d => d.is_active);
  const urgentCount = activeQueue.filter(d => d.urgency_tier === "urgent").length;
  const moderateCount = activeQueue.filter(d => d.urgency_tier === "moderate").length;
  const routineCount = activeQueue.filter(d => d.urgency_tier === "routine").length;
  
  const avgWaitMins = activeQueue.length ? Math.round(activeQueue.reduce((acc, curr) => {
    return acc + (Date.now() - new Date(curr.waitlist_joined_at).getTime()) / 60000;
  }, 0) / activeQueue.length) : 0;

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-[1400px]">
      {/* Main Column: The Queue */}
      <div className="flex-1 space-y-4">
        {/* Live System Ticker */}
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-mono shadow-sm overflow-hidden whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-emerald-600 font-bold"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"/> SYSTEM ONLINE</div>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">Active Engine: <span className="text-indigo-600">Gemini 1.5 Triage</span></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">Realtime Sink: <span className="text-indigo-600">Connected</span></span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1 text-slate-500 animate-[pulse_3s_ease-in-out_infinite]">Last update: {new Date().toLocaleTimeString()}</div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900"><Users className="h-6 w-6 text-indigo-600" />Live Queue</h1>
            <p className="text-sm text-slate-500">Central command for priority waitlist and automated triage.</p>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={globalFilter ?? ""} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Search patient…"
              className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none shadow-sm transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/60 text-slate-500">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i}>{columns.map((_, j) => <td key={j} className="px-4 py-2"><div className="h-4 w-full animate-pulse rounded bg-slate-100" /></td>)}</tr>
                )) : table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className={`transition-all duration-200 group ${row.original.is_active ? "hover:bg-indigo-50/30 hover:shadow-inner" : "opacity-50"} ${row.original.priority_score >= 4 ? "bg-red-50/10" : ""}`}>
                    {row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-2.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                  </tr>
                )) : (
                  <tr><td colSpan={columns.length} className="py-16 text-center text-slate-400">Queue is currently empty.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Side Panel: Insights & Activity */}
      <div className="w-full lg:w-80 shrink-0 space-y-4">
        {/* Wait Time Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-900 p-6 text-white shadow-lg relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-indigo-500/20 blur-2xl group-hover:bg-indigo-500/30 transition-all duration-700" />
          <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 relative z-10"><Activity className="h-3.5 w-3.5 text-indigo-400" />Queue Insights</h2>
          
          <div className="mt-6 space-y-6 relative z-10">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Avg Wait Time</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black tabular-nums tracking-tighter">{loading ? "-" : avgWaitMins}</span>
                <span className="text-sm font-medium text-slate-400">mins</span>
              </div>
              {avgWaitMins > 30 && <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-400 font-bold"><AlertTriangle className="h-3 w-3" /> Exceeding KPI (20m)</p>}
            </div>
            
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Priority Breakdown</p>
              <div className="flex items-center justify-between group/row hover:bg-slate-800 p-1 rounded transition-colors">
                <span className="flex items-center gap-2 text-sm text-slate-300"><span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]" /> Urgent</span>
                <span className="font-mono text-sm font-bold text-white tabular-nums">{loading ? "-" : urgentCount}</span>
              </div>
              <div className="flex items-center justify-between group/row hover:bg-slate-800 p-1 rounded transition-colors">
                <span className="flex items-center gap-2 text-sm text-slate-300"><span className="h-2 w-2 rounded-full bg-amber-400" /> Moderate</span>
                <span className="font-mono text-sm font-bold text-white tabular-nums">{loading ? "-" : moderateCount}</span>
              </div>
              <div className="flex items-center justify-between group/row hover:bg-slate-800 p-1 rounded transition-colors">
                <span className="flex items-center gap-2 text-sm text-slate-300"><span className="h-2 w-2 rounded-full bg-blue-400" /> Routine</span>
                <span className="font-mono text-sm font-bold text-white tabular-nums">{loading ? "-" : routineCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-md flex flex-col h-[400px]">
          <div className="border-b border-slate-100 p-4 flex items-center justify-between bg-slate-50/80 rounded-t-xl">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-indigo-600" /> Live Feed</h2>
            <Link href="/dashboard/audit" className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700">View All</Link>
          </div>
          <div className="flex-1 p-4 overflow-y-auto relative">
            <div className="absolute inset-y-0 left-6 w-[2px] bg-slate-100" />
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />)}
              </div>
            ) : logs.length ? (
              <div className="space-y-4">
                {logs.map((log) => (
                  <div key={log.id} className="relative flex gap-3 animate-page-in">
                    <div className="relative z-10 flex h-5 w-5 mt-0.5 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-slate-500 shadow-sm">
                      <FileText className="h-2.5 w-2.5" />
                    </div>
                    <div className="flex-1 pb-1">
                      <p className="text-[11px] font-semibold text-slate-900 leading-tight">{log.event_type.replace(/_/g, " ")}</p>
                      <p className="text-[9px] font-mono text-slate-400 mt-0.5">{new Date(log.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400 relative z-10 bg-white">No recent activity.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
