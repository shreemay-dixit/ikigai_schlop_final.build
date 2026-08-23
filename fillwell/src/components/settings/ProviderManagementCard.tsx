"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Stethoscope, Plus, Check, Mail, Phone } from "lucide-react";
import { Provider } from "@/lib/types/database";
import { providerFormSchema, ProviderFormValues } from "@/lib/validations";
import { formatPhone } from "@/lib/utils";
import { toast } from "sonner";

interface ProviderManagementCardProps {
  providers: Provider[];
  onRefresh: () => void;
}

export function ProviderManagementCard({
  providers,
  onRefresh,
}: ProviderManagementCardProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      name: "",
      specialty: "",
      email: "",
      phone: "",
      is_active: true,
    },
  });

  async function onSubmit(data: ProviderFormValues) {
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to add provider");
      toast.success("Provider registered successfully!");
      reset();
      setShowAddForm(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to add provider");
    }
  }

  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-stone-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-stone-100">
            Clinic Providers & Clinicians
          </h3>
          <p className="text-xs text-stone-400">
            Manage provider specialties and operating schedule availability.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Clinician
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-3 animate-in fade-in duration-200"
        >
          <h4 className="text-xs font-bold text-rose-300">
            Register New Clinician
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-stone-300 block mb-1">
                Full Name (with Title) *
              </label>
              <input
                type="text"
                {...register("name")}
                placeholder="e.g. Dr. Emily Thorne, MD"
                className="w-full rounded-lg bg-stone-950 border border-stone-800 px-3 py-1.5 text-xs text-stone-100 outline-none focus:border-rose-500"
              />
              {errors.name && (
                <p className="text-[10px] text-rose-400 mt-0.5">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-[11px] text-stone-300 block mb-1">
                Medical Specialty *
              </label>
              <input
                type="text"
                {...register("specialty")}
                placeholder="e.g. Dermatology & Mohs Surgery"
                className="w-full rounded-lg bg-stone-950 border border-stone-800 px-3 py-1.5 text-xs text-stone-100 outline-none focus:border-rose-500"
              />
              {errors.specialty && (
                <p className="text-[10px] text-rose-400 mt-0.5">
                  {errors.specialty.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-stone-300 block mb-1">
                Email Address
              </label>
              <input
                type="email"
                {...register("email")}
                placeholder="e.thorne@fillwellhealth.com"
                className="w-full rounded-lg bg-stone-950 border border-stone-800 px-3 py-1.5 text-xs text-stone-100 outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-stone-300 block mb-1">
                Phone
              </label>
              <input
                type="tel"
                {...register("phone")}
                placeholder="+1 (555) 123-4567"
                className="w-full rounded-lg bg-stone-950 border border-stone-800 px-3 py-1.5 text-xs text-stone-100 outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-md shadow-rose-600/20 transition disabled:opacity-50"
            >
              {isSubmitting ? "Registering..." : "Save Clinician"}
            </button>
          </div>
        </form>
      )}

      {/* Provider List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-stone-800 bg-stone-950 p-4 space-y-2 hover:border-stone-700 transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600/10 text-rose-400 border border-rose-500/20">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-100">{p.name}</h4>
                  <p className="text-[11px] text-rose-400 font-medium">
                    {p.specialty}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                ACTIVE
              </span>
            </div>

            <div className="text-[11px] text-stone-400 pt-2 border-t border-stone-900 space-y-1">
              {p.email && (
                <div className="flex items-center gap-1.5 font-mono">
                  <Mail className="h-3 w-3 text-stone-500" />
                  <span>{p.email}</span>
                </div>
              )}
              {p.phone && (
                <div className="flex items-center gap-1.5 font-mono">
                  <Phone className="h-3 w-3 text-stone-500" />
                  <span>{formatPhone(p.phone)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
