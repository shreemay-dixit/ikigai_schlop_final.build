"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, UserPlus, AlertCircle } from "lucide-react";
import { waitlistFormSchema, WaitlistFormValues } from "@/lib/validations";
import { Provider } from "@/lib/types/database";
import { toast } from "sonner";

interface AddWaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: Provider[];
  onSuccess: () => void;
}

export function AddWaitlistModal({
  isOpen,
  onClose,
  providers,
  onSuccess,
}: AddWaitlistModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WaitlistFormValues>({
    resolver: zodResolver(waitlistFormSchema),
    defaultValues: {
      patient_name: "",
      patient_phone: "",
      urgency_tier: "routine",
      provider_id: "",
      preferred_time_windows: ["mornings", "afternoons"],
      preferred_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      notes: "",
    },
  });

  const selectedWindows = watch("preferred_time_windows");
  const selectedDays = watch("preferred_days");

  function toggleWindow(w: string) {
    if (selectedWindows.includes(w)) {
      setValue(
        "preferred_time_windows",
        selectedWindows.filter((item) => item !== w)
      );
    } else {
      setValue("preferred_time_windows", [...selectedWindows, w]);
    }
  }

  function toggleDay(d: string) {
    if (selectedDays.includes(d)) {
      setValue(
        "preferred_days",
        selectedDays.filter((item) => item !== d)
      );
    } else {
      setValue("preferred_days", [...selectedDays, d]);
    }
  }

  async function onSubmit(data: WaitlistFormValues) {
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add patient to waitlist");
      }

      toast.success("Patient added to waitlist recovery matrix!");
      reset();
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to add patient");
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Add Patient to Slot Recovery Waitlist
              </h3>
              <p className="text-[11px] text-slate-400">
                Auto-dispatched via SMS/WhatsApp upon slot cancellation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Patient Name */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Patient Full Name *
            </label>
            <input
              type="text"
              {...register("patient_name")}
              placeholder="e.g. Maria Gonzalez"
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500 transition"
            />
            {errors.patient_name && (
              <p className="text-[11px] text-rose-400 mt-1">
                {errors.patient_name.message}
              </p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Mobile Phone (E.164 Format) *
            </label>
            <input
              type="tel"
              {...register("patient_phone")}
              placeholder="+1 (555) 987-6543"
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500 transition font-mono"
            />
            {errors.patient_phone && (
              <p className="text-[11px] text-rose-400 mt-1">
                {errors.patient_phone.message}
              </p>
            )}
          </div>

          {/* Urgency Tier & Preferred Clinician */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Urgency Priority Tier *
              </label>
              <select
                {...register("urgency_tier")}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500"
              >
                <option value="routine">Routine (Low)</option>
                <option value="moderate">Moderate (Standard)</option>
                <option value="urgent">Urgent (Highest Priority)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Assigned Clinician (Optional)
              </label>
              <select
                {...register("provider_id")}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500"
              >
                <option value="">Any Available Clinician</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Availability Time Windows */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Preferred Time Windows
            </label>
            <div className="flex gap-2">
              {["mornings", "afternoons", "evenings"].map((w) => {
                const active = selectedWindows.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleWindow(w)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize border transition ${
                      active
                        ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
            {errors.preferred_time_windows && (
              <p className="text-[11px] text-rose-400 mt-1">
                {errors.preferred_time_windows.message}
              </p>
            )}
          </div>

          {/* Preferred Days */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Available Days
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map(
                (d) => {
                  const active = selectedDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono capitalize border transition ${
                        active
                          ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40"
                          : "bg-slate-950 text-slate-400 border-slate-800"
                      }`}
                    >
                      {d.slice(0, 3)}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Clinical Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Clinical Context / Notes
            </label>
            <textarea
              {...register("notes")}
              placeholder="e.g. Post-op check, severe back pain, requests earliest morning slot."
              rows={2}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add to Priority Matrix"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
