import { NextRequest, NextResponse } from 'next/server';
import { clinicStore } from '@/lib/services/clinic-store';
import { Diagnostics } from '@/lib/diagnostics';
import { supabase } from '@/lib/supabase/client';

/**
 * Atomic Magic Link Claim Endpoint
 * Handles high-concurrency race condition claims via deterministic pessimistic locking.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const offerId = body.offer_id || body.offerId;

    if (!offerId) {
      return NextResponse.json(
        { success: false, error: 'Offer ID is required.' },
        { status: 400 }
      );
    }

    // 1. Locate Recovery Offer
    let offer = Array.from((clinicStore as any).recoveryOffers.values()).find(
      (o: any) => o.id === offerId
    ) as any;

    if (!offer) {
      return NextResponse.json(
        { success: false, error: 'Magic link offer expired or invalid.', code: 'OFFER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Locate Associated Recovery Event and Appointment
    const recEvent = (clinicStore as any).recoveryEvents.get(offer.recovery_event_id);
    const appointmentId = recEvent?.appointment_id || offer.appointment_id;

    if (!appointmentId) {
      return NextResponse.json(
        { success: false, error: 'No associated appointment for this offer.', code: 'APPOINTMENT_NOT_FOUND' },
        { status: 400 }
      );
    }

    // 2. Check Expiration Window
    if (new Date(offer.expires_at).getTime() < Date.now()) {
      offer.response_status = 'declined';
      return NextResponse.json(
        {
          success: false,
          error: 'This magic link offer has expired (10-minute window exceeded).',
          code: 'OFFER_EXPIRED',
        },
        { status: 410 }
      );
    }

    // 3. Execute Atomic Pessimistic Database Lock (Race Condition Engine)
    const claimResult = clinicStore.claimAppointmentAtomic(
      appointmentId,
      offer.patient_name,
      offer.patient_phone,
      offer.recovery_event_id
    );

    // If Atomic Claim Succeeded (Winner)
    if (claimResult.success) {
      offer.response_status = 'accepted';
      offer.response_text = 'Claimed via WhatsApp Magic Link';
      offer.responded_at = new Date().toISOString();

      Diagnostics.info(`Magic link claimed successfully by ${offer.patient_name} in ${Date.now() - startTime}ms`, {
        component: 'ClaimMagicLink',
        offerId,
        appointmentId,
      });

      return NextResponse.json({
        success: true,
        data: {
          appointment: claimResult.appointment,
          offer_id: offerId,
          claimed_by: offer.patient_name,
          claimed_at: new Date().toISOString(),
        },
        message: 'Appointment successfully secured and locked in your name!',
      });
    }

    // If Atomic Claim Failed (Race Condition Lost to Concurrent Patient)
    offer.response_status = 'declined';
    offer.response_text = 'Contention lost: Slot claimed by another candidate';
    offer.responded_at = new Date().toISOString();

    Diagnostics.warn(`Magic link claim race condition contention: ${claimResult.error}`, {
      component: 'ClaimMagicLink',
      offerId,
      appointmentId,
    });

    return NextResponse.json(
      {
        success: false,
        error: claimResult.error || 'Race Condition Lost: Another patient secured the slot.',
        code: 'RACE_CONDITION_LOST',
      },
      { status: 409 }
    );
  } catch (error: any) {
    Diagnostics.error('Fatal exception in claim-magic-link', { component: 'ClaimMagicLink' }, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error claiming slot' },
      { status: 500 }
    );
  }
}

/**
 * GET Handler to retrieve offer status for the Magic Link Portal
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const offerId = searchParams.get('offer_id');

  if (!offerId) {
    return NextResponse.json({ success: false, error: 'offer_id query param required' }, { status: 400 });
  }

  const offer = Array.from((clinicStore as any).recoveryOffers.values()).find(
    (o: any) => o.id === offerId
  ) as any;

  if (!offer) {
    return NextResponse.json({ success: false, error: 'Offer not found' }, { status: 404 });
  }

  const recEvent = (clinicStore as any).recoveryEvents.get(offer.recovery_event_id);
  const appointment = recEvent ? clinicStore.getAppointments().find((a) => a.id === recEvent.appointment_id) : null;

  return NextResponse.json({
    success: true,
    data: {
      offer,
      appointment,
      is_claimable:
        offer.response_status === 'pending' &&
        appointment &&
        (appointment.status === 'recovering' || appointment.status === 'cancelled') &&
        new Date(offer.expires_at).getTime() > Date.now(),
    },
  });
}
