import { NextRequest, NextResponse } from 'next/server';
import { analyzePatientTranscript } from '@/lib/services/gemini';

export interface TriageResult {
  intent: 'book_appointment' | 'reschedule' | 'cancel' | 'check_status' | 'general_inquiry';
  patient_name: string;
  patient_phone: string;
  service_type: string;
  urgency_tier: 'routine' | 'moderate' | 'urgent';
  priority_score: number;
  extracted_symptoms: string[];
  conversational_reply: string;
}

export async function POST(request: NextRequest) {
  try {
    const { transcript, channel = 'voice' } = await request.json();

    if (!transcript) {
      return NextResponse.json({ success: false, error: 'Transcript is required' }, { status: 400 });
    }

    const result = await analyzePatientTranscript(transcript);
    
    return NextResponse.json({ success: true, source: 'gemini_api', data: result });
  } catch (e: any) {
    console.error("Pipeline Fatal Error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
