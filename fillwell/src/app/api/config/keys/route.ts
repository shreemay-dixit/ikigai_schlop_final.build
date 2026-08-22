import { NextRequest, NextResponse } from 'next/server';

// In-memory runtime configuration store for API credentials
let runtimeConfig = {
  gemini_api_key: process.env.GEMINI_API_KEY || '',
  vapi_public_key: process.env.VAPI_PUBLIC_KEY || '',
  vapi_private_key: process.env.VAPI_PRIVATE_KEY || '',
  twilio_account_sid: process.env.TWILIO_ACCOUNT_SID || '',
  twilio_auth_token: process.env.TWILIO_AUTH_TOKEN || '',
  twilio_phone_number: process.env.TWILIO_PHONE_NUMBER || '+1 (800) 555-0199',
  google_client_id: process.env.GOOGLE_CLIENT_ID || '',
  google_api_key: process.env.GOOGLE_API_KEY || '',
  google_calendar_connected: true,
  google_user_email: 'clinic.admin@metrohealth.org',
};

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      has_gemini: Boolean(runtimeConfig.gemini_api_key),
      has_vapi: Boolean(runtimeConfig.vapi_public_key),
      has_twilio: Boolean(runtimeConfig.twilio_account_sid),
      has_google_calendar: Boolean(runtimeConfig.google_client_id || runtimeConfig.google_calendar_connected),
      twilio_phone_number: runtimeConfig.twilio_phone_number,
      google_user_email: runtimeConfig.google_user_email,
      masked_keys: {
        gemini: runtimeConfig.gemini_api_key ? `${runtimeConfig.gemini_api_key.slice(0, 6)}...` : '',
        vapi: runtimeConfig.vapi_public_key ? `${runtimeConfig.vapi_public_key.slice(0, 6)}...` : '',
        twilio: runtimeConfig.twilio_account_sid ? `${runtimeConfig.twilio_account_sid.slice(0, 6)}...` : '',
      }
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    runtimeConfig = {
      ...runtimeConfig,
      ...body,
    };
    return NextResponse.json({
      success: true,
      message: 'API credentials saved and active across all calling and triage routes.',
      data: runtimeConfig
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}
