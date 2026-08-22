'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Clock, Calendar, ShieldCheck, AlertOctagon, CheckCircle2, Lock, Sparkles, Building2, User, Phone, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function MagicLinkClaimPage() {
  const params = useParams();
  const offerId = params?.offerId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [offerData, setOfferData] = useState<any>(null);
  const [appointment, setAppointment] = useState<any>(null);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [isClaimSuccess, setIsClaimSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Offer & Appointment Status
  const fetchOfferDetails = useCallback(async () => {
    if (!offerId) return;

    try {
      setIsLoading(true);
      const res = await fetch(`/api/claim-magic-link?offer_id=${encodeURIComponent(offerId)}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setIsLockedOut(true);
        setErrorMessage(json.error || 'This priority magic link is invalid or expired.');
        return;
      }

      const { offer, appointment: apt, is_claimable } = json.data;
      setOfferData(offer);
      setAppointment(apt);

      if (!is_claimable) {
        setIsLockedOut(true);
        if (apt?.status === 'recovered') {
          setErrorMessage(`This slot has already been claimed by ${apt.recovered_by_patient_name || 'another patient'}.`);
        } else if (new Date(offer.expires_at).getTime() <= Date.now()) {
          setErrorMessage('This 10-minute priority reservation window has expired.');
        } else {
          setErrorMessage('This appointment slot is no longer open for recovery.');
        }
      }
    } catch (err: any) {
      setIsLockedOut(true);
      setErrorMessage('Failed to connect to the clinic recovery engine.');
    } finally {
      setIsLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    fetchOfferDetails();

    // Realtime Supabase Subscription on appointments table
    const channel = supabase
      .channel(`realtime-claim-${offerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          const updated = payload.new as any;
          if (updated && appointment && updated.id === appointment.id) {
            if (updated.status === 'recovered') {
              setIsLockedOut(true);
              setErrorMessage(`Slot Contention: This appointment was just secured by ${updated.recovered_by_patient_name || 'another patient'}.`);
              toast.error('Slot Just Claimed!', {
                description: 'Another patient confirmed this slot a fraction of a second ago.',
                duration: 5000,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOfferDetails, offerId, appointment]);

  // Execute Atomic Claim Mutation
  const handleClaimSlot = async () => {
    if (isClaiming || isLockedOut) return;

    setIsClaiming(true);

    try {
      const res = await fetch('/api/claim-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId }),
      });

      const data = await res.json();

      if (res.status === 200 && data.success) {
        setIsClaimSuccess(true);
        toast.success('Appointment Confirmed & Locked! 🎉', {
          description: 'Your slot has been secured with the provider.',
          duration: 8000,
        });
      } else if (res.status === 409) {
        // Race Condition Contention Lost
        setIsLockedOut(true);
        setErrorMessage(data.error || 'Race Condition Lost: Another patient secured the slot.');
        toast.error('Race Condition Lost: Another patient secured the slot.', {
          description: 'The slot was claimed concurrently moments before your request completed.',
          duration: 8000,
        });
      } else {
        toast.error('Failed to claim slot', {
          description: data.error || 'An unexpected error occurred.',
        });
      }
    } catch (err: any) {
      toast.error('Network Error: ' + err.message);
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-400">Verifying secure priority magic link...</p>
      </div>
    );
  }

  // 1. Success Confirmed Screen
  if (isClaimSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-500/40 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest font-bold text-emerald-400">Slot Confirmed & Locked</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">You're All Set!</h1>
            <p className="text-sm text-slate-300">
              Hi <strong>{offerData?.patient_name}</strong>, your appointment is officially booked in the clinic schedule.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-left space-y-3 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Service:</span>
              <span className="text-slate-200 font-bold">{appointment?.service_type || 'Clinical Consultation'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Scheduled Time:</span>
              <span className="text-emerald-400 font-bold">
                {appointment ? new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '2:30 PM Today'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Clinic:</span>
              <span className="text-slate-200 font-semibold">Fillwell Health Center</span>
            </div>
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-300">
            A confirmation WhatsApp message with directions and check-in instructions has been sent to your phone.
          </div>
        </div>
      </div>
    );
  }

  // 2. Strict Locked-Out Screen (Slot No Longer Available)
  if (isLockedOut) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest font-bold text-rose-400">Lock-Out Notice</span>
            <h1 className="text-2xl font-extrabold text-white">Slot No Longer Available</h1>
            <p className="text-sm text-slate-300">
              {errorMessage || 'This slot has already been claimed by another waitlisted candidate or the offer window expired.'}
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 space-y-2 text-left">
            <p className="flex items-center gap-2 text-slate-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-blue-400" /> What happens now?
            </p>
            <p>You remain <strong>#1 in line on the Fillwell Priority Waitlist</strong>. When the next opening occurs, you will receive an immediate WhatsApp notification.</p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Active Claim Screen with Massive One-Click Claim Button
  const timeDisplay = appointment
    ? new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '2:30 PM Today';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-8 text-slate-100 font-sans">
      
      {/* Top Brand Bar */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold">
            F
          </div>
          <span className="font-bold text-base tracking-tight text-white">Fillwell Health</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full font-mono font-medium">
          <Clock className="w-3.5 h-3.5 animate-spin" /> 10-Min Expiry
        </div>
      </div>

      {/* Main Card Content */}
      <div className="max-w-md mx-auto w-full my-auto py-8 space-y-6">
        
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Priority Access Opening
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Claim Your Slot
          </h1>
          <p className="text-sm text-slate-400">
            Hi <strong className="text-slate-200">{offerData?.patient_name}</strong>, an earlier appointment opened up just now.
          </p>
        </div>

        {/* Appointment Detail Pill */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Service Type</span>
              <p className="text-lg font-bold text-white">{appointment?.service_type || 'Clinical Consultation'}</p>
            </div>
            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
              <Calendar className="w-6 h-6" />
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-4 grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-slate-500 block">Time</span>
              <p className="text-base font-bold text-emerald-400 font-mono">{timeDisplay}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Duration</span>
              <p className="text-base font-bold text-slate-200 font-mono">30 Mins</p>
            </div>
          </div>
        </div>

        {/* Massive Primary CTA Button */}
        <button
          onClick={handleClaimSlot}
          disabled={isClaiming}
          className="w-full py-5 px-6 rounded-2xl font-extrabold text-lg text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 shadow-xl shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isClaiming ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Locking Appointment...</span>
            </>
          ) : (
            <>
              <span>Claim This Appointment</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>Protected by real-time atomic pessimistic locking</span>
        </p>

      </div>

      {/* Footer */}
      <div className="max-w-md mx-auto w-full text-center text-xs text-slate-600 pt-6">
        Fillwell Autonomous Healthcare Engine • Confidential & HIPAA Compliant
      </div>

    </div>
  );
}
