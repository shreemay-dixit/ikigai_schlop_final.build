import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, differenceInDays } from "date-fns";
import { AppointmentStatus, UrgencyTier, RecoveryStatus } from "./types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(isoString: string): string {
  try {
    return format(parseISO(isoString), "MMM d, yyyy h:mm a");
  } catch (e) {
    return isoString;
  }
}

export function formatTimeOnly(isoString: string): string {
  try {
    return format(parseISO(isoString), "h:mm a");
  } catch (e) {
    return isoString;
  }
}

export function formatDateOnly(isoString: string): string {
  try {
    return format(parseISO(isoString), "EEE, MMM d");
  } catch (e) {
    return isoString;
  }
}

export function calculateWaitDays(joinedIsoString: string): number {
  try {
    const days = differenceInDays(new Date(), parseISO(joinedIsoString));
    return Math.max(0, days);
  } catch (e) {
    return 0;
  }
}

export function formatPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = ("" + phone).replace(/\D/g, "");
  const match = cleaned.match(/^(\d{1})(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}`;
  }
  return phone;
}

export function getStatusBadgeConfig(status: AppointmentStatus): {
  label: string;
  className: string;
  dotColor: string;
} {
  switch (status) {
    case "confirmed":
      return {
        label: "Confirmed",
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        dotColor: "bg-emerald-400",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        dotColor: "bg-rose-400",
      };
    case "recovering":
      return {
        label: "Recovering Wave",
        className: "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse",
        dotColor: "bg-amber-400",
      };
    case "recovered":
      return {
        label: "Recovered",
        className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        dotColor: "bg-indigo-400",
      };
    case "no_show":
      return {
        label: "No Show",
        className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
        dotColor: "bg-slate-400",
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        dotColor: "bg-blue-400",
      };
    default:
      return {
        label: status,
        className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
        dotColor: "bg-slate-400",
      };
  }
}

export function getUrgencyBadgeConfig(urgency: UrgencyTier): {
  label: string;
  className: string;
} {
  switch (urgency) {
    case "urgent":
      return {
        label: "Urgent",
        className: "bg-rose-500/15 text-rose-400 border-rose-500/30 font-semibold",
      };
    case "moderate":
      return {
        label: "Moderate",
        className: "bg-amber-500/15 text-amber-400 border-amber-500/30 font-medium",
      };
    case "routine":
      return {
        label: "Routine",
        className: "bg-slate-500/15 text-slate-400 border-slate-500/30",
      };
  }
}
