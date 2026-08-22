"use client";

import React, { useState, useEffect } from "react";
import { X, Key, Sparkles, PhoneCall, Calendar, Check, Save } from "lucide-react";
import { toast } from "sonner";

interface ApiCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiCredentialsModal({ isOpen, onClose }: ApiCredentialsModalProps) {
  const [geminiKey, setGeminiKey] = useState("");
  const [vapiKey, setVapiKey] = useState("");
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioPhone, setTwilioPhone] = useState("+1 (800) 555-0199");
  const [googleClientId, setGoogleClientId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    async function loadConfig() {
      try {
        const res = await fetch("/api/config/keys");
        const data = await res.json();
        if (data.success && data.data) {
          if (data.data.twilio_phone_number) setTwilioPhone(data.data.twilio_phone_number);
        }
      } catch (e) {}
    }
    loadConfig();
  }, [isOpen]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/config/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gemini_api_key: geminiKey,
          vapi_public_key: vapiKey,
          twilio_account_sid: twilioSid,
          twilio_auth_token: twilioToken,
          twilio_phone_number: twilioPhone,
          google_client_id: googleClientId,
        }),
      });

      if (!res.ok) throw new Error("Failed to save credentials");
      toast.success("Calling, Messaging & Calendar API credentials saved successfully!");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to update API keys");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Calling & Messaging API Credentials
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Gemini AI &bull; Vapi Voice &bull; Twilio Carrier &bull; Google Calendar
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

        <form onSubmit={handleSave} className="space-y-4">
          {/* Gemini API Key */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                Google Gemini API Key
              </span>
              <span className="text-[10px] text-slate-500 font-mono">AI Studio Key</span>
            </div>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-100 font-mono outline-none focus:border-indigo-500"
            />
          </div>

          {/* Vapi Public Key */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <PhoneCall className="h-3.5 w-3.5 text-cyan-400" />
                Vapi Voice Public Key
              </span>
              <span className="text-[10px] text-slate-500 font-mono">WebRTC Voice AI</span>
            </div>
            <input
              type="password"
              value={vapiKey}
              onChange={(e) => setVapiKey(e.target.value)}
              placeholder="vapi-pub-..."
              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-100 font-mono outline-none focus:border-cyan-500"
            />
          </div>

          {/* Twilio Carrier SID & Token */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-200 block">
              Twilio SMS & Phone Carrier
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Account SID</label>
                <input
                  type="text"
                  value={twilioSid}
                  onChange={(e) => setTwilioSid(e.target.value)}
                  placeholder="AC..."
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-100 font-mono outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Auth Token</label>
                <input
                  type="password"
                  value={twilioToken}
                  onChange={(e) => setTwilioToken(e.target.value)}
                  placeholder="auth_token"
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-100 font-mono outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Assigned Twilio Number</label>
              <input
                type="text"
                value={twilioPhone}
                onChange={(e) => setTwilioPhone(e.target.value)}
                placeholder="+18005550199"
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-100 font-mono outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Google Calendar */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                Google Calendar Client ID / API Key
              </span>
            </div>
            <input
              type="text"
              value={googleClientId}
              onChange={(e) => setGoogleClientId(e.target.value)}
              placeholder="apps.googleusercontent.com..."
              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-100 font-mono outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{loading ? "Saving..." : "Save Credentials"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
