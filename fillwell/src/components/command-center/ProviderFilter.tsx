"use client";

import React from "react";
import { UserCheck, Stethoscope } from "lucide-react";
import { Provider } from "@/lib/types/database";
import { cn } from "@/lib/utils";

interface ProviderFilterProps {
  providers: Provider[];
  selectedProviderId: string | null;
  onSelectProvider: (id: string | null) => void;
  isLoading?: boolean;
}

export function ProviderFilter({
  providers,
  selectedProviderId,
  onSelectProvider,
  isLoading,
}: ProviderFilterProps) {
  if (isLoading) {
    return (
      <div className="flex gap-2 animate-pulse overflow-x-auto pb-1">
        <div className="h-9 w-28 bg-stone-800 rounded-lg"></div>
        <div className="h-9 w-40 bg-stone-800 rounded-lg"></div>
        <div className="h-9 w-40 bg-stone-800 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        onClick={() => onSelectProvider(null)}
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border",
          selectedProviderId === null || selectedProviderId === "all"
            ? "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/20"
            : "bg-stone-900/80 text-stone-300 border-stone-800 hover:border-stone-700 hover:bg-stone-800"
        )}
      >
        <UserCheck className="h-3.5 w-3.5" />
        All Clinicians ({providers.length})
      </button>

      {providers.map((p) => {
        const isSelected = selectedProviderId === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelectProvider(p.id)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border",
              isSelected
                ? "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/20"
                : "bg-stone-900/80 text-stone-300 border-stone-800 hover:border-stone-700 hover:bg-stone-800"
            )}
          >
            <Stethoscope className="h-3.5 w-3.5 text-rose-400" />
            <span>{p.name}</span>
            <span className="text-[10px] text-stone-400 font-normal">({p.specialty.split(' ')[0]})</span>
          </button>
        );
      })}
    </div>
  );
}
