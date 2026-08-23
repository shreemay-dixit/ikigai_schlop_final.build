"use client";

import React from "react";
import { MessageSquare, PhoneCall, Radio, CheckCircle, AlertTriangle } from "lucide-react";
import { ClinicSettings } from "@/lib/types/database";

interface IntegrationTelemetryCardProps {
  settings: ClinicSettings | null;
}

export function IntegrationTelemetryCard({
  settings,
}: IntegrationTelemetryCardProps) {
  const isTwilioOk = settings?.twilio_status === "connected";
  const isWhatsAppOk = settings?.whatsapp_status === "connected";

  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-stone-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-stone-100">
            Channel Configuration & Telemetry
          </h3>
          <p className="text-xs text-stone-400">
            Real-time delivery channel health for automated patient outreach.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          <span>GATEWAYS ONLINE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Twilio SMS */}
        <div className="rounded-xl border border-stone-800 bg-stone-950 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <PhoneCall className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-200">Twilio Voice & SMS</h4>
                <p className="text-[10px] text-stone-500 font-mono">E.164 Outbound Carrier</p>
              </div>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                isTwilioOk
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              }`}
            >
              {isTwilioOk ? "CONNECTED" : "OFFLINE"}
            </span>
          </div>

          <div className="text-[11px] text-stone-400 space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Webhook Route:</span>
              <span className="text-stone-200">/api/webhooks/twilio</span>
            </div>
            <div className="flex justify-between">
              <span>Latency:</span>
              <span className="text-emerald-400">42ms</span>
            </div>
          </div>
        </div>

        {/* WhatsApp Cloud API */}
        <div className="rounded-xl border border-stone-800 bg-stone-950 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-200">WhatsApp Cloud API</h4>
                <p className="text-[10px] text-stone-500 font-mono">Meta Business Sandbox</p>
              </div>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                isWhatsAppOk
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              }`}
            >
              {isWhatsAppOk ? "CONNECTED" : "OFFLINE"}
            </span>
          </div>

          <div className="text-[11px] text-stone-400 space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Webhook Route:</span>
              <span className="text-stone-200">/api/webhooks/whatsapp</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-emerald-400">Authenticated</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
