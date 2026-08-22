import { NextRequest, NextResponse } from 'next/server';
import { clinicStore } from '@/lib/services/clinic-store';
import { appointmentFormSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('provider_id');
    const appointments = clinicStore.getAppointments(providerId);
    return NextResponse.json({ success: true, data: appointments });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = appointmentFormSchema.parse(body);
    const newAppointment = clinicStore.createAppointment(validated);
    return NextResponse.json({ success: true, data: newAppointment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error' },
      { status: 400 }
    );
  }
}
