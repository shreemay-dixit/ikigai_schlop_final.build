import { NextRequest, NextResponse } from 'next/server';
import { clinicStore } from '@/lib/services/clinic-store';
import { waitlistFormSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('provider_id');
    const waitlist = clinicStore.getWaitlist(providerId);
    return NextResponse.json({ success: true, data: waitlist });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const body = {
      preferred_time_windows: ['mornings', 'afternoons'],
      preferred_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      ...rawBody,
    };
    const validated = waitlistFormSchema.parse(body);
    const entry = clinicStore.createWaitlistEntry(validated);
    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error' },
      { status: 400 }
    );
  }
}
