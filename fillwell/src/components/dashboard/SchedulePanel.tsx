"use client";

import React, { useState } from "react";
import {
  Calendar, Clock, User, Phone, AlertCircle, CheckCircle2,
  XCircle, Zap, Loader2, Plus, RefreshCw, Radio, Check,
  Ticket
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateAppointmentDialog } from "@/components/dashboard/CreateAppointmentDialog";

export interface AppointmentItem {
  id: string;
  patient_name: string;
  patient_phone: string;
  service_type: string;
  start_time: string;
  end_time: string;
  status: "confirmed" | "cancelled" | "recovering" | "recovered" | "completed";
  token_number?: string;
  estimated_wait_mins?: number;
  queue_position?: number;
  recovered_by_patient_name?: string | null;
  cancellation_reason?: string | null;
}

interface SchedulePanelProps {
  appointments: AppointmentItem[];
  loading: boolean;
  onRefresh: () => void;
}

export function SchedulePanel({ appointments, loading, onRefresh }: SchedulePanelProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCancelAppointment = async (apt: AppointmentItem) => {
    if (cancellingId === apt.id || completingId === apt.id) return;
    setCancellingId(apt.id);

    try {
      const res = await fetch(`/api/appointments/${apt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          cancellation_reason: "Cancelled by Clinic Operator — Wave Dispatched",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to cancel appointment");
      }

      toast.success(`Slot cancelled! Recovery wave dispatched to standby radar.`, {
        description: `Patient: ${apt.patient_name} (${apt.token_number || "TK-101"}) · Service: ${apt.service_type}`,
      });
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel appointment");
    } finally {
      setCancellingId(null);
    }
  };

  const handleCompleteAppointment = async (apt: AppointmentItem) => {
    if (completingId === apt.id || cancellingId === apt.id) return;
    setCompletingId(apt.id);

    try {
      const res = await fetch(`/api/appointments/${apt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to mark consultation completed");
      }

      toast.success(`Consultation completed for ${apt.patient_name}! 🎉`, {
        description: `Token: ${apt.token_number || "TK-101"} · Rolling velocity updated`,
      });
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete appointment");
    } finally {
      setCompletingId(null);
    }
  };

  const statusBadge = (status: AppointmentItem["status"], recoveredBy?: string | null) => {
    switch (status) {
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Confirmed
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 border border-stone-300 px-2.5 py-0.5 text-[11px] font-bold text-stone-700">
            <Check className="h-3 w-3 text-emerald-600" /> Completed
          </span>
        );
      case "cancelled":
      case "recovering":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-black text-rose-700 animate-pulse">
            <Zap className="h-3 w-3 text-rose-600 fill-current" /> Standby Buzzing
          </span>
        );
      case "recovered":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-[11px] font-bold text-purple-700">
            <Radio className="h-3 w-3 text-purple-600" /> Recovered ({recoveredBy || "Claimed"})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-bold text-stone-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100 shadow-sm">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 leading-none">Schedule & Appointment Grid</h2>
            <p className="text-xs text-stone-500 mt-1">Live clinical bookings with token tracking, dynamic wait estimates, and completion controls.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-stone-800 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Appointment</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-stone-200 bg-stone-50/70 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Token & Patient</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Time Slot</th>
                <th className="px-4 py-3">Estimated Wait</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading && appointments.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-5 py-4">
                      <div className="h-5 w-full animate-pulse rounded-lg bg-stone-100" />
                    </td>
                  </tr>
                ))
              ) : appointments.length > 0 ? (
                appointments.map((apt) => {
                  const isCancelling = cancellingId === apt.id;
                  const isCompleting = completingId === apt.id;
                  const canAction = apt.status === "confirmed" || apt.status === "recovered";

                  return (
                    <tr
                      key={apt.id}
                      className={`transition-colors hover:bg-stone-50/80 ${
                        apt.status === "cancelled" || apt.status === "recovering"
                          ? "bg-rose-50/30"
                          : apt.status === "completed"
                          ? "bg-stone-50/40 opacity-75"
                          : ""
                      }`}
                    >
                      {/* Token & Patient */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex flex-col items-center justify-center rounded-xl bg-stone-900 text-white font-mono font-bold text-[10px] px-2 py-1 shadow-sm min-w-[54px]">
                            <span className="text-[8px] text-rose-300 uppercase tracking-tight">TOKEN</span>
                            <span>{apt.token_number || "TK-101"}</span>
                          </div>
                          <div>
                            <p className="font-bold text-stone-900">{apt.patient_name}</p>
                            <p className="text-[11px] font-mono text-stone-500">{apt.patient_phone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Service */}
                      <td className="px-4 py-3.5 font-medium text-stone-700">
                        {apt.service_type}
                      </td>

                      {/* Time Slot */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-stone-800 font-mono font-medium">
                          <Clock className="h-3.5 w-3.5 text-stone-400" />
                          <span>
                            {new Date(apt.start_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Dynamic Wait Time */}
                      <td className="px-4 py-3.5">
                        {apt.status === "completed" ? (
                          <span className="text-[11px] font-mono font-medium text-stone-400">
                            Completed
                          </span>
                        ) : apt.status === "cancelled" || apt.status === "recovering" ? (
                          <span className="text-[11px] font-mono font-bold text-rose-600">
                            Vacated
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-800">
                            <Clock className="h-3 w-3 text-amber-600" />
                            <span>
                              {apt.estimated_wait_mins && apt.estimated_wait_mins <= 2
                                ? "Now Serving"
                                : `~${apt.estimated_wait_mins || 5} mins`}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3.5">
                        {statusBadge(apt.status, apt.recovered_by_patient_name)}
                      </td>

                      {/* Actions (Done Button + Cancel Button) */}
                      <td className="px-5 py-3.5 text-right">
                        {canAction ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Done / Mark Completed Button */}
                            <button
                              onClick={() => handleCompleteAppointment(apt)}
                              disabled={isCompleting || isCancelling}
                              title="Mark consultation completed"
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50 active:scale-95 cursor-pointer"
                            >
                              {isCompleting ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Finishing…</span>
                                </>
                              ) : (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Done</span>
                                </>
                              )}
                            </button>

                            {/* Cancel Button */}
                            <button
                              onClick={() => handleCancelAppointment(apt)}
                              disabled={isCancelling || isCompleting}
                              title="Cancel appointment and broadcast standby buzzer"
                              className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition disabled:opacity-50 active:scale-95 cursor-pointer"
                            >
                              {isCancelling ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Cancelling…</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3.5 w-3.5" />
                                  <span>Cancel</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : apt.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 font-mono">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Finished
                          </span>
                        ) : apt.status === "recovering" || apt.status === "cancelled" ? (
                          <span className="text-[11px] font-bold text-rose-600 font-mono">
                            ⚡ Broadcasting...
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-400 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-8">
                    <EmptyState
                      icon={Calendar}
                      title="No Appointments Scheduled"
                      description="Click 'New Appointment' above to schedule a patient slot and test recovery triggers."
                      action={
                        <button
                          onClick={() => setIsDialogOpen(true)}
                          className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-stone-800 transition"
                        >
                          <Plus className="h-3.5 w-3.5" /> Create First Appointment
                        </button>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateAppointmentDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onCreated={onRefresh}
      />
    </div>
  );
}
