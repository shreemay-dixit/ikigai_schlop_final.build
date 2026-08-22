"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, ShieldCheck, Activity } from "lucide-react";

export function CalendarTimelineWidget() {
  const [slots, setSlots] = useState<any[]>([]);
  const [loadFactor, setLoadFactor] = useState(0.4);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCalendar() {
      try {
        const res = await fetch("/api/calendar");
        const data = await res.json();
        if (data.success) {
          setSlots(data.data.slots || []);
          setLoadFactor(data.data.congestion_load_factor || 0.4);
        }
      } catch (e) {
      } finally {
        setLoading(false);
      }
    }

    loadCalendar();
  }, []);

  const openSlots = slots.filter((s) => s.is_available).length;
  const busySlots = slots.filter((s) => !s.is_available).length;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100">
              Google Calendar Real-Time Availability
            </h4>
            <p className="text-[10px] text-slate-400">
              Synced with Organization Calendar &bull; {openSlots} Open Slots &bull; {busySlots} Booked Blocks
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          CONGESTION: {Math.round(loadFactor * 100)}%
        </span>
      </div>

      {/* Mini timeline slot blocks */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {slots.slice(0, 12).map((s) => (
          <div
            key={s.slot_id}
            title={`${s.display_time}: ${s.status.toUpperCase()}`}
            className={`flex-shrink-0 px-2 py-1.5 rounded-lg border text-center font-mono text-[10px] transition ${
              s.is_available
                ? "bg-slate-950 border-slate-800 text-slate-300"
                : "bg-indigo-950/40 border-indigo-500/40 text-indigo-300 font-bold"
            }`}
          >
            <div>{s.display_time}</div>
            <div className={`text-[9px] ${s.is_available ? "text-slate-500" : "text-indigo-400"}`}>
              {s.is_available ? "OPEN" : "BUSY"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
