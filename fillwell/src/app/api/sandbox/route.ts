import { NextRequest, NextResponse } from 'next/server';
import { clinicStore } from '@/lib/services/clinic-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.action === 'seed') {
      clinicStore.seedSandboxDemo();
      return NextResponse.json({ success: true, message: 'Seeded test recovery wave & appointments' });
    } else if (body.action === 'reset') {
      clinicStore.resetSandbox();
      return NextResponse.json({ success: true, message: 'Purged database state to clean start' });
    }
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
