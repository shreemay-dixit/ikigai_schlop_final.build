import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  error?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Failed to load clinical data",
  error = "An unexpected error occurred while communicating with the database.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center rounded-xl border border-rose-500/20 bg-rose-500/5">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 mb-3">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-rose-200 mb-1">{title}</h3>
      <p className="text-sm text-stone-400 max-w-md mb-4">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium border border-stone-700 transition"
        >
          <RefreshCw className="h-4 w-4" />
          Retry Connection
        </button>
      )}
    </div>
  );
}
