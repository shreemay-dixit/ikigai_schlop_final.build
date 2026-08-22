import React from "react";

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full rounded-xl border border-slate-800 bg-slate-900/60 p-4 animate-pulse">
      <div className="flex gap-4 border-b border-slate-800 pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-800 rounded flex-1"></div>
        ))}
      </div>
      <div className="space-y-3 pt-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-9 bg-slate-800/60 rounded flex-1"
                style={{ opacity: 1 - r * 0.12 }}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
