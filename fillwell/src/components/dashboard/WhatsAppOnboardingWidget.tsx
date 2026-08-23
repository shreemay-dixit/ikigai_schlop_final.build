'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Radio,
  Zap,
  CheckCircle2,
  ExternalLink,
  Users,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Play
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';

interface LiveStandbyWidgetProps {
  onRefreshWaitlist?: () => void;
}

export function WhatsAppOnboardingWidget({ onRefreshWaitlist }: LiveStandbyWidgetProps) {
  const [portalUrl, setPortalUrl] = useState('http://localhost:3000/standby');
  const [standbyCount, setStandbyCount] = useState(0);
  const [isTriggering, setIsTriggering] = useState(false);
  const [recentCancellations, setRecentCancellations] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPortalUrl(`${window.location.origin}/standby`);
    }

    // Fetch initial standby waitlist count
    const loadWaitlist = async () => {
      try {
        const res = await fetch('/api/waitlist');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setStandbyCount(data.data.filter((w: any) => w.is_active).length);
        }
      } catch {}
    };
    loadWaitlist();

    // Supabase Realtime Listener on waitlist_entries
    const channel = supabase
      .channel('dashboard-standby-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waitlist_entries' },
        () => {
          loadWaitlist();
          if (onRefreshWaitlist) onRefreshWaitlist();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onRefreshWaitlist]);

  // Fast Simulator to trigger an immediate slot cancellation
  const handleTriggerCancellation = async () => {
    setIsTriggering(true);
    try {
      // 1. Create a dummy appointment
      const intakeRes = await fetch('/api/client/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Live Standby Slot', channel: 'standby_demo' }),
      });
      const intakeData = await intakeRes.json();
      const ticketId = intakeData.ticket_id;

      // 2. Cancel it to fire the buzzer
      const cancelRes = await fetch(`/api/appointments/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          cancellation_reason: 'Doctor rescheduled emergency slot',
        }),
      });

      if (cancelRes.ok) {
        toast.success('⚡ Slot Cancelled! Standby buzzers fired in real-time!', {
          description: 'Phones currently on /standby will instantly display the CLAIM button.',
        });
        if (onRefreshWaitlist) onRefreshWaitlist();
      }
    } catch (err: any) {
      toast.error('Error triggering cancellation: ' + err.message);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-emerald-950/50 via-stone-900 to-stone-950 border-2 border-emerald-500/30 rounded-3xl p-6 shadow-2xl space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl animate-pulse">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Live Standby Portal & Digital Buzzer
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold">
                WEBSOCKET LIVE
              </span>
            </h3>
            <p className="text-xs text-stone-400">
              Zero telecom friction. Patients scan the QR code on mobile to activate their live digital buzzer and claim slots instantly.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/standby"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg transition"
          >
            <span>Open Mobile Standby Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Grid: QR Code + How It Works + Fast Trigger Simulator */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        
        {/* QR Code Container */}
        <div className="md:col-span-4 flex flex-col items-center justify-center p-5 bg-white rounded-2xl shadow-xl text-stone-900 space-y-3 min-h-[250px]">
          <QRCodeSVG
            value={portalUrl}
            size={170}
            level="M"
            includeMargin={true}
          />
          <div className="text-center">
            <p className="text-[11px] font-bold text-stone-800 uppercase tracking-wider">Scan with Phone Camera</p>
            <p className="text-[10px] text-stone-500">Opens Live Standby Buzzer directly</p>
          </div>
        </div>

        {/* Live Metrics & Instructions */}
        <div className="md:col-span-4 space-y-3 text-xs font-sans">
          <div className="p-3.5 bg-stone-950/80 border border-stone-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Active Standby Patients</span>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {standbyCount} Connected
              </span>
            </div>
            <p className="text-stone-300 text-[11px] leading-relaxed">
              When patients scan the QR code and join the standby list, they connect via Supabase Realtime WebSocket with 0ms delay.
            </p>
          </div>

          <div className="p-3.5 bg-stone-950/80 border border-stone-800 rounded-2xl space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> First-to-Tap Atomic Claim
            </span>
            <p className="text-stone-300 text-[11px] leading-relaxed">
              When any cancellation occurs, all waiting phones display the buzzer button. The fastest tap locks the slot via Postgres RPC!
            </p>
          </div>
        </div>

        {/* Live Demonstration Simulator */}
        <div className="md:col-span-4 bg-stone-950 border border-stone-800 rounded-2xl p-5 space-y-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" /> Live Demo Simulator
            </span>
            <p className="text-[11px] text-stone-400">
              Open <code className="text-emerald-400">/standby</code> on your phone or in another tab, then click below to trigger a live cancellation:
            </p>
          </div>

          <button
            onClick={handleTriggerCancellation}
            disabled={isTriggering}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transform active:scale-95 transition disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            {isTriggering ? 'Firing Cancellation...' : '⚡ Trigger Cancellation (Test Buzzer)'}
          </button>

          <p className="text-[10px] text-stone-500 text-center flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Pessimistic DB Locks • 409 Conflict Protection</span>
          </p>
        </div>

      </div>

    </div>
  );
}
