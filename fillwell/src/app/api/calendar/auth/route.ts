import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email } = body;

    if (action === 'connect') {
      return NextResponse.json({
        success: true,
        message: 'Google Calendar successfully authenticated and connected.',
        account: {
          email: email || 'dr.lin@metrohealth.org',
          calendar_id: 'primary',
          connected_at: new Date().toISOString(),
          status: 'connected',
        },
      });
    } else if (action === 'disconnect') {
      return NextResponse.json({
        success: true,
        message: 'Google Calendar disconnected.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
