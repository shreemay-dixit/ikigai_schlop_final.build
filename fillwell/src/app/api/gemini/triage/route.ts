import { NextRequest, NextResponse } from 'next/server';
import { analyzePatientTranscript, TriageResult } from '@/lib/services/gemini';

export async function POST(request: NextRequest) {
  try {
    const { transcript, conversation_history, channel = 'web_chat' } = await request.json();

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Transcript is required as a non-empty string.' },
        { status: 400 }
      );
    }

    const result: TriageResult = await analyzePatientTranscript(transcript, conversation_history);
    
    return NextResponse.json({
      success: true,
      source: 'gemini_clinical_ai',
      data: result,
    });
  } catch (e: any) {
    console.error("Gemini Triage API Pipeline Error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
