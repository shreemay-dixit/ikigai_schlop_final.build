import { NextRequest, NextResponse } from 'next/server';
import { clinicStore } from '@/lib/services/clinic-store';
import { dispatchWave } from '@/lib/dispatchWave';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apt = clinicStore.getAppointmentById(params.id);
    if (!apt) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: apt });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status, cancellation_reason } = body;
    const updated = clinicStore.updateAppointmentStatus(params.id, status, cancellation_reason);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    // Trigger WhatsApp Magic Link Wave Dispatch on Cancellation / Recovery
    if (status === 'cancelled' || status === 'recovering') {
      try {
        await dispatchWave(params.id);
      } catch (waveErr) {
        console.error('Wave dispatch warning:', waveErr);
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
