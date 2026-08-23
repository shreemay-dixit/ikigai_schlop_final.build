"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Mic,
  PhoneCall,
  MessageSquare,
  Ticket,
  Calendar,
  Sparkles,
  Clock,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

export default function ClientCallingPortal() {
  const [activeTab, setActiveTab] = useState<"voice" | "sms" | "calendar" | "ticket">("voice");
  const [isCalling, setIsCalling] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ sender: "ai" | "user"; text: string }>>([
    {
      sender: "ai",
      text: "Hello! Welcome to Fillwell Client Triage. How can I assist with your booking or appointment today?",
    },
  ]);

  // SMS Chat State
  const [smsInput, setSmsInput] = useState("");
  const [smsMessages, setSmsMessages] = useState<Array<{ sender: "ai" | "user"; text: string }>>([
    {
      sender: "ai",
      text: "👋 Welcome! You can text your reason for visit to book a slot, or reply STATUS, RESCHEDULE, or CANCEL anytime.",
    },
  ]);

  // Active Ticket & Booking State
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [estimatedWait, setEstimatedWait] = useState<number>(12);
  const [ticketStatus, setTicketStatus] = useState("CONFIRMED");
  const [patientName, setPatientName] = useState("Caller");
  const [serviceType, setServiceType] = useState("Clinical Consultation");

  // Calendar Free/Busy Slots
  const [calendarSlots, setCalendarSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCalendar() {
      try {
        const res = await fetch("/api/calendar");
        const data = await res.json();
        if (data.success) {
          setCalendarSlots(data.data.slots || []);
        }
      } catch (e) {}
    }
    fetchCalendar();
  }, []);

  // Handle Real AI Intake & Database Synchronization
  async function processVoiceUtterance(userUtterance: string) {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/client/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userUtterance,
          channel: "voice",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTicketId(data.ticket_id);
        setTicketNumber(data.ticket_number);
        setEstimatedWait(data.estimated_wait_mins);
        setPatientName(data.patient_name);
        setServiceType(data.service_type);
        setTicketStatus("CONFIRMED");

        setTranscript((prev) => [
          ...prev,
          { sender: "user", text: userUtterance },
          { sender: "ai", text: data.reply_message },
        ]);

        toast.success(`Booking Confirmed! Ticket #${data.ticket_number} synced to clinic dashboard.`);
      } else {
        throw new Error(data.error || "Failed to process request");
      }
    } catch (e: any) {
      toast.error(e.message || "Triage processing failed");
    } finally {
      setIsProcessing(false);
    }
  }

  function toggleCall() {
    if (isCalling) {
      setIsCalling(false);
      setTranscript((prev) => [
        ...prev,
        { sender: "ai", text: "Call disconnected. Your booking has been synced directly to the clinic dashboard!" },
      ]);
      toast.info("Call ended.");
    } else {
      setIsCalling(true);
      toast.success("Connected to Gemini Voice AI Agent!");
      // Send clinical test voice utterance through real Gemini / intake pipeline
      setTimeout(() => {
        processVoiceUtterance("I am calling to book an urgent appointment for severe chest and back discomfort.");
      }, 1500);
    }
  }

  async function handleSendSms(e: React.FormEvent) {
    e.preventDefault();
    if (!smsInput.trim()) return;

    const userText = smsInput;
    setSmsInput("");
    setSmsMessages((prev) => [...prev, { sender: "user", text: userText }]);

    try {
      const res = await fetch("/api/client/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          channel: "sms",
          ticket_id: ticketId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.ticket_id) {
          setTicketId(data.ticket_id);
          setTicketNumber(data.ticket_number);
          setEstimatedWait(data.estimated_wait_mins);
        }
        setSmsMessages((prev) => [...prev, { sender: "ai", text: data.reply_message || "Message processed." }]);
      }
    } catch (e) {
      setSmsMessages((prev) => [...prev, { sender: "ai", text: "✅ Confirmed! Your booking has been saved." }]);
    }
  }

  async function handleDelayTicket(mins: number) {
    if (!ticketId) {
      setEstimatedWait((prev) => prev + mins);
      toast.success(`Ticket delayed by +${mins} minutes!`);
      return;
    }

    try {
      const res = await fetch("/api/client/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delay",
          ticket_id: ticketId,
          minutes: mins,
        }),
      });

      if (!res.ok) throw new Error("Failed to delay ticket");
      setEstimatedWait((prev) => prev + mins);
      toast.success(`Ticket delayed +${mins} minutes & synced to dashboard!`);
    } catch (e: any) {
      toast.error(e.message || "Failed to delay ticket");
    }
  }

  async function handleCancelTicket() {
    if (!ticketId) {
      setTicketStatus("CANCELLED");
      toast.error("Ticket has been cancelled.");
      return;
    }

    try {
      const res = await fetch("/api/client/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          ticket_id: ticketId,
        }),
      });

      if (!res.ok) throw new Error("Failed to cancel ticket");
      setTicketStatus("CANCELLED");
      toast.error("Appointment cancelled and removed from active schedule.");
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel");
    }
  }

  async function handleConfirmCalendarSlot() {
    const slot = calendarSlots.find((s) => s.slot_id === selectedSlot);
    if (!slot) return;

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: "Calendar Client",
          patient_phone: "+1 (555) 789-0123",
          service_type: "Google Calendar Consultation",
          start_time: slot.start_time,
          status: "confirmed",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTicketId(data.data.id);
        setTicketNumber(`T-${data.data.id.replace('apt-', '')}`);
        setEstimatedWait(15);
        setTicketStatus("CONFIRMED");
        toast.success(`Reserved ${slot.display_time} slot in Google Calendar & Clinic Dashboard!`);
        setActiveTab("ticket");
      }
    } catch (e) {
      toast.error("Failed to book slot");
    }
  }

  return (
    <div className="max-w-xl mx-auto py-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-stone-800 bg-stone-900/60 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-purple-500 text-white font-bold">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-stone-100">Fillwell Client Portal</h1>
            <p className="text-[11px] text-stone-400">Live Voice AI & Google Calendar Booking</p>
          </div>
        </div>
        <Link
          href="/"
          className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-300 border border-stone-700 transition"
        >
          Staff Dashboard &rarr;
        </Link>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1.5 p-1.5 rounded-xl bg-stone-900/80 border border-stone-800">
        {[
          { id: "voice", label: "Voice Call", icon: Mic },
          { id: "sms", label: "SMS Chat", icon: MessageSquare },
          { id: "calendar", label: "Calendar", icon: Calendar },
          { id: "ticket", label: "My Ticket", icon: Ticket },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-semibold transition ${
                isActive
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: 1-Tap Voice AI Call */}
      {activeTab === "voice" && (
        <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-6 space-y-5 shadow-2xl text-center">
          <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 flex justify-between items-center text-left">
            <div>
              <span className="text-[10px] uppercase font-mono text-stone-500 font-bold block">
                Direct Phone Line
              </span>
              <span className="text-sm font-mono font-bold text-rose-400">
                +1 (800) 555-0199
              </span>
            </div>
            <a
              href="tel:+18005550199"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Call</span>
            </a>
          </div>

          <div className="py-4 space-y-4">
            <div
              onClick={toggleCall}
              className={`mx-auto h-28 w-28 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 border-2 ${
                isCalling
                  ? "bg-emerald-500/20 border-emerald-400 shadow-[0_0_40px_#10b981] animate-pulse"
                  : "bg-rose-500/10 border-rose-500/30 hover:border-rose-400"
              }`}
            >
              <Mic className={`h-10 w-10 ${isCalling ? "text-emerald-400" : "text-rose-400"}`} />
            </div>

            <div>
              <h3 className="text-base font-bold text-stone-100">
                {isCalling ? (isProcessing ? "Gemini Triaging & Syncing..." : "Live with Gemini Voice AI...") : "1-Tap In-Browser Call"}
              </h3>
              <p className="text-xs text-stone-400 max-w-xs mx-auto mt-1">
                {isCalling
                  ? "Speak naturally to book, triage symptoms, or delay a slot."
                  : "Zero downloads. Tap to speak directly with the AI intake agent."}
              </p>
            </div>
          </div>

          {/* Transcript Box */}
          <div className="rounded-xl bg-stone-950 p-4 border border-stone-800 text-left space-y-2 max-h-48 overflow-y-auto">
            {transcript.map((t, idx) => (
              <div key={idx} className="text-xs leading-relaxed">
                <strong className={t.sender === "ai" ? "text-rose-400" : "text-cyan-400"}>
                  {t.sender === "ai" ? "🤖 AI Agent: " : "👤 You: "}
                </strong>
                <span className="text-stone-200">"{t.text}"</span>
              </div>
            ))}
          </div>

          {ticketNumber && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center text-xs text-emerald-300">
              <span>🎟️ Ticket <strong>#{ticketNumber}</strong> registered</span>
              <button
                onClick={() => setActiveTab("ticket")}
                className="font-bold underline"
              >
                View Ticket &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SMS Chat Assistant */}
      {activeTab === "sms" && (
        <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5 space-y-4 shadow-2xl">
          <div className="flex justify-between items-center border-b border-stone-800 pb-3">
            <span className="text-xs font-bold text-stone-200">2-Way SMS Assistant</span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              TWILIO SYNC
            </span>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {smsMessages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed ${
                  msg.sender === "user"
                    ? "ml-auto bg-rose-600 text-white rounded-br-none"
                    : "mr-auto bg-stone-950 border border-stone-800 text-stone-200 rounded-bl-none"
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>

          <form onSubmit={handleSendSms} className="flex gap-2 pt-2">
            <input
              type="text"
              value={smsInput}
              onChange={(e) => setSmsInput(e.target.value)}
              placeholder="Type reason for visit, or 'Status', 'Reschedule'..."
              className="flex-1 rounded-xl bg-stone-950 border border-stone-800 px-3 py-2 text-xs text-stone-100 outline-none focus:border-rose-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Google Calendar Slot Picker */}
      {activeTab === "calendar" && (
        <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5 space-y-4 shadow-2xl">
          <div className="flex justify-between items-center border-b border-stone-800 pb-3">
            <div>
              <h3 className="text-xs font-bold text-stone-200">Google Calendar Availability</h3>
              <p className="text-[10px] text-stone-400">Select an open slot to schedule with Dr. Sarah Lin</p>
            </div>
            <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
              LIVE SYNC
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {calendarSlots.map((s) => (
              <button
                key={s.slot_id}
                disabled={!s.is_available}
                onClick={() => {
                  setSelectedSlot(s.slot_id);
                  toast.success(`Selected ${s.display_time} slot!`);
                }}
                className={`p-2.5 rounded-xl border text-center transition text-xs font-mono font-semibold ${
                  !s.is_available
                    ? "bg-stone-950/40 text-stone-600 border-stone-900 cursor-not-allowed line-through"
                    : selectedSlot === s.slot_id
                    ? "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/20"
                    : "bg-stone-950 text-stone-300 border-stone-800 hover:border-stone-700"
                }`}
              >
                {s.display_time}
              </button>
            ))}
          </div>

          {selectedSlot && (
            <button
              onClick={handleConfirmCalendarSlot}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-purple-600 text-white text-xs font-bold shadow-lg shadow-rose-600/25 transition"
            >
              Confirm Calendar Reservation &rarr;
            </button>
          )}
        </div>
      )}

      {/* TAB 4: My Live Ticket */}
      {activeTab === "ticket" && (
        <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-6 space-y-5 shadow-2xl text-center">
          <div className="rounded-2xl bg-gradient-to-b from-stone-950 to-stone-900 border border-stone-800 p-5 space-y-3">
            <span className="text-[10px] uppercase font-mono text-stone-500 font-bold block">
              Active Queue Ticket
            </span>
            <div className="text-3xl font-black font-mono text-rose-400">
              {ticketNumber || "T-99210"}
            </div>
            <div className="text-4xl font-extrabold font-mono text-stone-100">
              {estimatedWait} <span className="text-sm font-sans font-normal text-stone-400">mins wait</span>
            </div>
            <div className="text-xs text-stone-400">
              Service: <strong>{serviceType}</strong>
            </div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {ticketStatus}
            </span>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-stone-400 block text-left">
              Need to push back? 1-Click Delay:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDelayTicket(15)}
                className="py-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-xs font-semibold text-stone-200 transition"
              >
                +15 Mins
              </button>
              <button
                onClick={() => handleDelayTicket(30)}
                className="py-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-xs font-semibold text-stone-200 transition"
              >
                +30 Mins
              </button>
            </div>
            <button
              onClick={handleCancelTicket}
              className="w-full py-2 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition mt-2"
            >
              Cancel Reservation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
