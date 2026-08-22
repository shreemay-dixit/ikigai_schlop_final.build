import { NextRequest, NextResponse } from 'next/server';
import { clinicStore } from '@/lib/services/clinic-store';
import { processNegotiation } from '@/lib/services/ai-negotiator';
import { Diagnostics } from '@/lib/diagnostics';

/**
 * Twilio Inbound SMS Webhook
 * Processes patient SMS replies (acceptances, declines, inquiries) and returns TwiML SMS responses.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let fromNumber = '';
    let bodyText = '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      fromNumber = formData.get('From')?.toString() || '';
      bodyText = formData.get('Body')?.toString() || '';
    } else {
      const json = await request.json().catch(() => ({}));
      fromNumber = json.From || json.from || '';
      bodyText = json.Body || json.body || json.message || '';
    }

    Diagnostics.info(`Inbound SMS received from ${fromNumber}: "${bodyText}"`, { component: 'TwilioSmsWebhook' });

    // Look for active recovering slot
    const recoveringApt = clinicStore.getAppointments().find(a => a.status === 'recovering' || a.status === 'cancelled');
    const slotInfo = {
      appointment_id: recoveringApt?.id || 'apt-1',
      start_time: recoveringApt?.start_time || new Date().toISOString(),
      display_time: recoveringApt ? new Date(recoveringApt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '2:30 PM',
      service_type: recoveringApt?.service_type || 'Consultation',
    };

    const negotiation = await processNegotiation({
      patient_message: bodyText,
      open_slot: slotInfo,
      patient_name: 'SMS Caller',
      patient_phone: fromNumber,
    });

    // Return TwiML XML response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${negotiation.reply_message}</Message>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error: any) {
    Diagnostics.error('Twilio SMS webhook error', { component: 'TwilioSmsWebhook' }, error);
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Message>Your request has been received.</Message></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
