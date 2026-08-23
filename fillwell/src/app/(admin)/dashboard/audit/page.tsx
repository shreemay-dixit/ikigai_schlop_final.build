"use client";

import React, { useEffect, useState } from "react";
import { FileText, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Log {
  id: string; entity_type: string; event_type: string; entity_id: string;
  appointment_id?: string | null; created_at: string; payload: Record<string, any>;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit");
      const json = await res.json();
      setLogs((json.data || []).reverse());
    } catch { toast.error("Failed to fetch audit logs"); }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter((l) =>
    `${l.entity_type} ${l.event_type} ${l.entity_id} ${JSON.stringify(l.payload)}`.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-stone-900"><FileText className="h-6 w-6 text-rose-600" />Audit Log</h1>
          <p className="text-sm text-stone-500">Immutable record of every automated AI action and system event.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -transtone-y-1/2 text-stone-400" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter logs…"
              className="w-full sm:w-64 rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
          </div>
          <button onClick={fetchLogs} className="rounded-lg border border-stone-200 bg-white p-2 text-stone-500 transition hover:bg-stone-50 hover:text-stone-700 shadow-sm">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50/60 text-stone-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Timestamp</th>
                <th className="px-4 py-3 text-left font-semibold">Entity</th>
                <th className="px-4 py-3 text-left font-semibold">Event</th>
                <th className="px-4 py-3 text-left font-semibold">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-stone-100" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-stone-100" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-32 animate-pulse rounded bg-stone-100" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-48 animate-pulse rounded bg-stone-100" /></td>
                </tr>
              )) : filtered.length ? filtered.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-stone-50/50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-stone-500">
                    {new Date(log.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-semibold text-stone-700 uppercase">{log.entity_type}</span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-stone-800">{log.event_type}</td>
                  <td className="px-4 py-3">
                    <pre className="max-w-md overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-stone-50 border border-stone-100 px-2 py-1 font-mono text-[11px] text-stone-600" title={JSON.stringify(log.payload, null, 2)}>
                      {JSON.stringify(log.payload)}
                    </pre>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="py-12 text-center text-stone-400">No audit logs recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-stone-100 bg-stone-50/60 px-4 py-2.5 text-xs text-stone-500">{filtered.length} entries</div>
      </div>
    </div>
  );
}
