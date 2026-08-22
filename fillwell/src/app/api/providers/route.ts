import { NextRequest, NextResponse } from 'next/server';
import { clinicStore } from '@/lib/services/clinic-store';
import { providerFormSchema } from '@/lib/validations';

export async function GET() {
  try {
    const providers = clinicStore.getProviders();
    return NextResponse.json({ success: true, data: providers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = providerFormSchema.parse(body);
    const prov = clinicStore.createProvider(validated);
    return NextResponse.json({ success: true, data: prov }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error' },
      { status: 400 }
    );
  }
}
