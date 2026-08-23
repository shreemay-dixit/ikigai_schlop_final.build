import { Diagnostics } from '@/lib/diagnostics';
import { clinicStore } from '@/lib/services/clinic-store';

export interface DispatchWaveResult {
  success: boolean;
  recovery_event_id: string;
  offers_created: number;
  offers: {
    offer_id: string;
    patient_name: string;
    patient_phone: string;
    magic_link: string;
  }[];
  error?: string;
}

/**
 * Deterministic Wave Dispatch Engine for Realtime Standby Buzzer
 * Selects top 3 prioritized candidates, records recovery event waves,
 * and publishes realtime broadcast events.
 */
export async function dispatchWave(appointmentId: string): Promise<DispatchWaveResult> {
  const t0 = Date.now();

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const apt = clinicStore.getAppointments().find((a) => a.id === appointmentId);
    Diagnostics.invariant(Boolean(apt), `Appointment not found for ID: ${appointmentId}`, { component: 'dispatchWave' });

    // 1. Fetch Top 3 Active Candidates based on Urgency Tier & Priority Score
    const urgencyWeight: Record<string, number> = { urgent: 3, moderate: 2, routine: 1 };
    const waitlist = clinicStore.getWaitlist(apt?.provider_id);
    const topCandidates = waitlist
      .filter((w) => w.is_active)
      .sort((a, b) => {
        const uDiff = (urgencyWeight[b.urgency_tier] || 1) - (urgencyWeight[a.urgency_tier] || 1);
        if (uDiff !== 0) return uDiff;
        return (b.priority_score || 1) - (a.priority_score || 1);
      })
      .slice(0, 3);

    // 2. Clean up prior recovery events/offers for this appointment
    const existingRecEvents = Array.from((clinicStore as any).recoveryEvents.values()).filter((r: any) => r.appointment_id === appointmentId);
    existingRecEvents.forEach((r: any) => {
      for (const [k, o] of Array.from((clinicStore as any).recoveryOffers.entries()) as [string, any][]) {
        if (o.recovery_event_id === r.id) {
          (clinicStore as any).recoveryOffers.delete(k);
        }
      }
      (clinicStore as any).recoveryEvents.delete(r.id);
    });

    // 3. Create Recovery Event Wave
    const recoveryEventId = `rec-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const waveEvent = {
      id: recoveryEventId,
      clinic_id: apt?.clinic_id || '00000000-0000-0000-0000-000000000001',
      appointment_id: appointmentId,
      wave_number: 1,
      status: 'active' as const,
      current_wave_candidates: topCandidates.length,
      wave_started_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_paused: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      appointment: apt,
    };

    (clinicStore as any).recoveryEvents.set(recoveryEventId, waveEvent);

    const offersSummary: DispatchWaveResult['offers'] = [];

    for (let i = 0; i < topCandidates.length; i++) {
      const candidate = topCandidates[i];
      const offerId = `off-${Date.now()}-${i + 1}`;
      const magicLink = `${appUrl}/claim/${offerId}`;

      const offerRecord = {
        id: offerId,
        recovery_event_id: recoveryEventId,
        waitlist_entry_id: candidate.id,
        patient_name: candidate.patient_name,
        patient_phone: candidate.patient_phone,
        offer_sent_at: new Date().toISOString(),
        expires_at: expiresAt,
        response_status: 'pending' as const,
        channel: 'live_standby' as const,
        created_at: new Date().toISOString(),
      };

      (clinicStore as any).recoveryOffers.set(offerId, offerRecord);

      offersSummary.push({
        offer_id: offerId,
        patient_name: candidate.patient_name,
        patient_phone: candidate.patient_phone,
        magic_link: magicLink,
      });
    }

    Diagnostics.info(`Live Standby Wave Dispatched for ${offersSummary.length} candidates`, {
      component: 'dispatchWave',
      appointmentId,
      elapsed_ms: Date.now() - t0,
    });

    return {
      success: true,
      recovery_event_id: recoveryEventId,
      offers_created: offersSummary.length,
      offers: offersSummary,
    };
  } catch (error: any) {
    Diagnostics.error('Fatal error executing dispatchWave', { component: 'dispatchWave', appointmentId }, error);
    throw error;
  }
}
