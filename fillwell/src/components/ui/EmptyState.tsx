import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-stone-200 bg-stone-50/50">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-500 mb-3 shadow-inner">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-bold text-stone-800">{title}</h3>
      <p className="mt-1 text-xs text-stone-500 max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
