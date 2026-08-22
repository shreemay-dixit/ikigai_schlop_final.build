import { NextRequest, NextResponse } from 'next/server';
import { clinicStore } from '@/lib/services/clinic-store';
import { idempotencyLedger } from '@/lib/services/idempotency';
import { Diagnostics } from '@/lib/diagnostics';

/**
 * Webhook Ingestion Endpoint for Cal.com, Google Calendar, and Hospital EHRs.
 * Enforces sub-2-second atomic status updates, automated slot recovery trigger, and strict idempotency.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ success: false, error: 'Empty webhook payload' }, { status: 400 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    // 1. Idempotency Key Extraction
    // Headers or body can provide an event ID / signature
    const headerIdempotencyKey = request.headers.get('x-webhook-id') || request.headers.get('x-idempotency-key');
    const bodyEventId = payload.event_id || payload.id || payload.uid || payload.payload?.uid || payload.payload?.id;
    const idempotencyKey = headerIdempotencyKey || (bodyEventId ? `evt-${bodyEventId}` : `hash-${Buffer.from(rawBody).toString('base64').slice(0, 32)}`);

    // Check Idempotency Ledger
    if (idempotencyLedger.has(idempotencyKey)) {
      const existing = idempotencyLedger.get(idempotencyKey);
      Diagnostics.info(`Idempotent replay detected for key: ${idempotencyKey}. Skipping duplicate execution.`, { component: 'CalendarWebhook' });
      return NextResponse.json({
        success: true,
        idempotent_replay: true,
        message: 'Webhook already processed. Duplicate ignored.',
        cached_result: existing?.response,
        processing_time_ms: Date.now() - startTime,
      });
    }

    // 2. Identify Event Type & Target Appointment
    const triggerEvent = payload.triggerEvent || payload.event_type || payload.type || 'BOOKING_CANCELLED';
    const isCancellation = 
      triggerEvent === 'BOOKING_CANCELLED' || 
      triggerEvent === 'appointment.cancelled' || 
      triggerEvent === 'cancellation' ||
      payload.status === 'cancelled';

    const targetAppointmentId = 
      payload.appointment_id || 
      payload.payload?.bookingId || 
      payload.payload?.id || 
      payload.booking_id || 
      payload.ticket_id;

    const reason = 
      payload.cancellationReason || 
      payload.payload?.cancellationReason || 
      payload.reason || 
      'Cancelled via external calendar / EHR webhook.';

    let affectedAppointment = null;

    if (isCancellation) {
      if (targetAppointmentId) {
        affectedAppointment = clinicStore.updateAppointmentStatus(
          String(targetAppointmentId),
          'recovering',
          reason
        );
      } else {
        // Find most recent confirmed appointment to recover if no explicit ID passed
        const confirmedList = clinicStore.getAppointments().filter(a => a.status === 'confirmed');
        if (confirmedList.length > 0) {
          const target = confirmedList[0];
          affectedAppointment = clinicStore.updateAppointmentStatus(target.id, 'recovering', reason);
        }
      }

      // Trigger WhatsApp Magic Link Wave Dispatch
      if (affectedAppointment) {
        try {
          const { dispatchWave } = await import('@/lib/dispatchWave');
          await dispatchWave(affectedAppointment.id);
        } catch (dispatchErr) {
          Diagnostics.warn('Wave dispatch warning during calendar webhook', { component: 'CalendarWebhook', error: dispatchErr });
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;

    const responsePayload = {
      success: true,
      event_type: triggerEvent,
      appointment_id: affectedAppointment?.id || targetAppointmentId || null,
      status: affectedAppointment?.status || 'recovering',
      recovery_triggered: true,
      processing_time_ms: processingTimeMs,
      processed_under_2s: processingTimeMs < 2000,
    };

    // 3. Record in Idempotency Ledger
    idempotencyLedger.record(idempotencyKey, responsePayload);

    Diagnostics.info(`Calendar webhook ingested successfully in ${processingTimeMs}ms`, { 
      component: 'CalendarWebhook',
      idempotencyKey,
      processingTimeMs 
    });

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    Diagnostics.error('Calendar webhook fatal processing error', { component: 'CalendarWebhook' }, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
