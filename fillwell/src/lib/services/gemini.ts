import { Diagnostics } from '@/lib/diagnostics';

export interface CalendarContext {
  current_date: string;
  current_day: string;
  current_time: string;
  is_clinic_open_now: boolean;
  operating_hours: string;
  timezone: string;
  upcoming_available_days: string[];
}

export interface TriageResult {
  intent: 'book_appointment' | 'reschedule' | 'cancel' | 'check_status' | 'general_inquiry' | 'clarification';
  patient_name: string;
  patient_phone: string;
  service_type: string;
  urgency_tier: 'routine' | 'moderate' | 'urgent';
  priority_score: number;
  extracted_symptoms: string[];
  conversational_reply: string;
  is_complete_triage: boolean;
  missing_information: string[];
  suggested_next_steps: string[];
  calendar_context: CalendarContext;
}

/**
 * Returns dynamic real-time calendar and clinic availability context
 */
import { clinicStore } from '@/lib/services/clinic-store';

export function getLiveCalendarContext(customDate?: Date | string | null): CalendarContext {
  const settings = clinicStore.getSettings();
  const dateToUse = customDate
    ? new Date(customDate)
    : settings.simulated_date_time
    ? new Date(settings.simulated_date_time)
    : new Date();

  const now = isNaN(dateToUse.getTime()) ? new Date() : dateToUse;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayName = days[now.getDay()];
  const monthName = months[now.getMonth()];
  const dateNum = now.getDate();
  const year = now.getFullYear();

  const hours = now.getHours();
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
  const isClinicOpen = isWeekday && hours >= 8 && hours < 17;

  // Next available days
  const upcomingDays: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + i);
    upcomingDays.push(`${days[nextDate.getDay()]}, ${months[nextDate.getMonth()]} ${nextDate.getDate()}`);
  }

  return {
    current_date: `${dayName}, ${monthName} ${dateNum}, ${year}`,
    current_day: dayName,
    current_time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    is_clinic_open_now: isClinicOpen,
    operating_hours: 'Monday - Friday: 08:00 AM - 05:00 PM EST (24/7 Emergency Standby Radar)',
    timezone: 'America/New_York (EST)',
    upcoming_available_days: upcomingDays,
  };
}

/**
 * High-Precision Local Clinical NLP Engine (Fallback / Zero-Quota)
 * Incorporates Calendar Context and Conversational Guidance
 */
function localClinicalNLPFallback(transcript: string, calendarCtx: CalendarContext, history?: string[]): TriageResult {
  const lower = transcript.toLowerCase().trim();

  // Check if input is too vague or greeting-only (needs conversational guidance)
  const isGreetingOrVague = 
    lower.length < 10 ||
    /^(hi|hello|hey|greetings|good morning|good afternoon|help|book|appointment|i need doctor|doctor|sick)$/i.test(lower) ||
    (!lower.includes('pain') && !lower.includes('fever') && !lower.includes('urgent') && !lower.includes('cancel') && !lower.includes('routine') && !lower.includes('checkup') && !lower.includes('my name') && !lower.includes('emergency'));

  // 1. Intent Detection
  let intent: TriageResult['intent'] = 'book_appointment';
  if (isGreetingOrVague && !lower.includes('cancel') && !lower.includes('status')) {
    intent = 'clarification';
  } else if (lower.includes('reschedule') || lower.includes('delay') || lower.includes('push back') || lower.includes('postpone')) {
    intent = 'reschedule';
  } else if (lower.includes('cancel') || lower.includes('drop') || lower.includes('delete')) {
    intent = 'cancel';
  } else if (lower.includes('status') || lower.includes('wait') || lower.includes('position') || lower.includes('queue')) {
    intent = 'check_status';
  } else if (lower.includes('hours') || lower.includes('location') || lower.includes('address') || lower.includes('open') || lower.includes('day') || lower.includes('date')) {
    intent = 'general_inquiry';
  }

  // 2. Symptom & Urgency Extraction
  const extracted_symptoms: string[] = [];
  let urgency_tier: TriageResult['urgency_tier'] = 'routine';
  let priority_score = 1;
  let service_type = 'General Clinical Consultation';
  let is_complete_triage = true;
  const missing_information: string[] = [];
  const suggested_next_steps: string[] = [];

  // High Urgency / Emergency
  if (
    lower.includes('chest pain') || lower.includes('heart') || lower.includes('shortness of breath') ||
    lower.includes('difficulty breathing') || lower.includes('severe') || lower.includes('unbearable') ||
    lower.includes('bleeding heavily') || lower.includes('unconscious') || lower.includes('fracture') ||
    lower.includes('broken bone') || lower.includes('allergic reaction') || lower.includes('anaphylaxis') ||
    lower.includes('stroke') || lower.includes('emergency')
  ) {
    urgency_tier = 'urgent';
    priority_score = 5;
    service_type = 'Emergency & Acute Care';
    if (lower.includes('chest pain') || lower.includes('heart')) extracted_symptoms.push('Acute Chest Discomfort / Cardiac');
    if (lower.includes('shortness of breath') || lower.includes('breathing')) extracted_symptoms.push('Respiratory Distress');
    if (lower.includes('fracture') || lower.includes('broken')) extracted_symptoms.push('Suspected Bone Fracture');
    if (lower.includes('bleeding')) extracted_symptoms.push('Acute Hemorrhage / Bleeding');
    if (extracted_symptoms.length === 0) extracted_symptoms.push('High-Acuity Acute Symptoms');
  } 
  // Moderate Urgency
  else if (
    lower.includes('fever') || lower.includes('high temperature') || lower.includes('infection') ||
    lower.includes('vomiting') || lower.includes('diarrhea') || lower.includes('moderate pain') ||
    lower.includes('back pain') || lower.includes('migraine') || lower.includes('sprain') ||
    lower.includes('flu') || lower.includes('cough') || lower.includes('rash') || lower.includes('burn')
  ) {
    urgency_tier = 'moderate';
    priority_score = 3;
    service_type = 'Urgent Clinical Review';
    if (lower.includes('fever')) extracted_symptoms.push('Elevated Body Temperature / Pyrexia');
    if (lower.includes('back pain')) extracted_symptoms.push('Lumbar / Musculoskeletal Pain');
    if (lower.includes('migraine') || lower.includes('headache')) extracted_symptoms.push('Severe Migraine / Headache');
    if (lower.includes('infection')) extracted_symptoms.push('Suspected Bacterial/Viral Infection');
    if (extracted_symptoms.length === 0) extracted_symptoms.push('Moderate Clinical Symptoms');
  } 
  // Casual / Incomplete query
  else if (isGreetingOrVague) {
    is_complete_triage = false;
    urgency_tier = 'routine';
    priority_score = 1;
    service_type = 'General Inquiry & Intake';
    missing_information.push('specific_symptoms', 'urgency_level', 'patient_name');
    suggested_next_steps.push(
      'Describe what symptoms you are experiencing',
      'Mention how urgent it feels (e.g. severe pain, fever, or routine checkup)',
      'Provide your name for the clinical waitlist'
    );
  } 
  // Routine / Preventive
  else {
    urgency_tier = 'routine';
    priority_score = 1;
    service_type = 'Routine Clinical Checkup & Follow-up';
    extracted_symptoms.push('Routine Consultation / Wellness Review');
  }

  // 3. Name Extraction
  let patient_name = 'Patient';
  const namePatterns = [
    /(?:my name is|i am|this is|i'm|name is|patient:?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:call me)\s+([A-Z][a-z]+)/i
  ];
  for (const pattern of namePatterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      patient_name = match[1].trim();
      break;
    }
  }

  if (patient_name === 'Patient' && !isGreetingOrVague) {
    patient_name = 'Alex Morgan'; // Default demo patient
  }

  // 4. Phone Extraction
  let patient_phone = '+1 (555) 019-2834';
  const phoneMatch = transcript.match(/(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/);
  if (phoneMatch) {
    patient_phone = phoneMatch[0];
  }

  // 5. Conversational Reply with Calendar Context
  let conversational_reply = '';
  if (!is_complete_triage) {
    conversational_reply = `Hello! Today is ${calendarCtx.current_date} (${calendarCtx.current_time}). ${
      calendarCtx.is_clinic_open_now
        ? 'Our clinic is currently open.'
        : 'Our regular clinic hours are 8 AM - 5 PM, but our Live Standby Radar is active 24/7.'
    } To help you get scheduled or placed on the standby queue, could you describe what symptoms you're experiencing and how urgently you need to be seen?`;
  } else if (intent === 'general_inquiry') {
    conversational_reply = `Today is ${calendarCtx.current_date}. Our operating hours are ${calendarCtx.operating_hours}. Our next available regular openings begin on ${calendarCtx.upcoming_available_days[0]}. We also have the 24/7 Live Standby Radar for instant cancellation claims.`;
  } else if (intent === 'cancel') {
    conversational_reply = `I have logged your cancellation request for ${calendarCtx.current_day}. Your slot will be immediately released to standby patients on the radar.`;
  } else {
    conversational_reply = `Hello ${patient_name}! Today is ${calendarCtx.current_date}. I have triaged your symptoms (${extracted_symptoms.join(', ')}) as ${urgency_tier.toUpperCase()} priority (Score ${priority_score}/5) for ${service_type}. You are ready to enter the Live Standby Radar for immediate placement.`;
  }

  return {
    intent,
    patient_name,
    patient_phone,
    service_type,
    urgency_tier,
    priority_score,
    extracted_symptoms,
    conversational_reply,
    is_complete_triage,
    missing_information,
    suggested_next_steps,
    calendar_context: calendarCtx,
  };
}

/**
 * Main Gemini AI Clinical Triage & Chat Engine
 * Integrates Live Calendar Context + Conversational Guidance
 */
export async function analyzePatientTranscript(transcript: string, conversationHistory?: string[]): Promise<TriageResult> {
  const calendarCtx = getLiveCalendarContext();
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey || geminiKey.includes('placeholder')) {
    Diagnostics.info('Using Zero-Quota Local Clinical NLP Engine (with Calendar Context)', { component: 'TriageService' });
    return localClinicalNLPFallback(transcript, calendarCtx, conversationHistory);
  }

  const prompt = `You are the Fillwell Clinical AI Assistant & Triage Chatbot for Metro Urgent Care Clinic.
You are interacting with a patient who wants to book, reschedule, cancel, or inquire about healthcare visits.

LIVE CALENDAR & CLINIC CONTEXT:
- Today's Date: ${calendarCtx.current_date}
- Current Day of Week: ${calendarCtx.current_day}
- Current Time: ${calendarCtx.current_time}
- Timezone: ${calendarCtx.timezone}
- Clinic Status: ${calendarCtx.is_clinic_open_now ? 'OPEN (Walk-ins & scheduled visits active)' : 'AFTER HOURS (24/7 Live Standby Radar Active)'}
- Operating Hours: ${calendarCtx.operating_hours}
- Upcoming Next Openings: ${calendarCtx.upcoming_available_days.join(', ')}

BEHAVIOR RULES:
1. ALWAYS be aware of the exact current day and date (${calendarCtx.current_date}).
2. IF the patient input is VAGUE, brief, casual, or missing critical clinical information (e.g. "hi", "can I get an appointment?", "I feel sick", "what days are you open?"):
   - Set "is_complete_triage" to false.
   - Act as an empathetic clinical chatbot: acknowledge the date/time and ask guiding questions to help them specify symptoms, urgency, or preferred time so their request can reach a structured JSON-worthy intake.
   - List what is missing in "missing_information" (e.g. ["symptoms", "urgency_level", "patient_name"]).
3. IF the patient input PROVIDES specific symptoms, intent, or reasons for visit (e.g. "chest pain and shortness of breath", "fever 102 since morning", "I want to cancel 2pm"):
   - Set "is_complete_triage" to true.
   - Assess urgency_tier ("urgent", "moderate", "routine") and priority_score (1 to 5).
   - Extract patient_name, phone, symptoms, and service_type.
   - Give an empathetic conversational_reply confirming their triage.

OUTPUT STRICT JSON MATCHING THIS EXACT SCHEMA (no markdown wrapping):
{
  "intent": "book_appointment" | "reschedule" | "cancel" | "check_status" | "general_inquiry" | "clarification",
  "patient_name": string (default "Patient" or name if mentioned),
  "patient_phone": string (default "+1 (555) 019-2834"),
  "service_type": string (e.g. "Emergency & Acute Care", "Urgent Clinical Review", "Routine Physical Checkup", "General Consultation"),
  "urgency_tier": "urgent" | "moderate" | "routine",
  "priority_score": integer 1 to 5,
  "extracted_symptoms": string[],
  "conversational_reply": string,
  "is_complete_triage": boolean,
  "missing_information": string[],
  "suggested_next_steps": string[]
}

Patient Input: "${transcript}"`;

  const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-pro'];
  let geminiRes: Response | null = null;

  for (const model of modelsToTry) {
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
          signal: AbortSignal.timeout(2500),
        }
      );

      if (geminiRes.ok) break;
      if (geminiRes.status === 429 || geminiRes.status === 503 || geminiRes.status === 404 || geminiRes.status === 400) {
        continue;
      } else {
        break;
      }
    } catch {
      continue;
    }
  }

  if (!geminiRes || !geminiRes.ok) {
    Diagnostics.warn('Gemini cloud models busy or unavailable. Using Zero-Quota Local NLP Engine with Calendar Context.', { 
      component: 'TriageService',
      status: geminiRes?.status 
    });
    return localClinicalNLPFallback(transcript, calendarCtx, conversationHistory);
  }

  try {
    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) {
      return localClinicalNLPFallback(transcript, calendarCtx, conversationHistory);
    }

    let cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    return {
      ...parsed,
      calendar_context: calendarCtx,
      missing_information: parsed.missing_information || [],
      suggested_next_steps: parsed.suggested_next_steps || [],
      is_complete_triage: parsed.is_complete_triage !== undefined ? parsed.is_complete_triage : true,
    };
  } catch (parseError: any) {
    Diagnostics.warn('Gemini response parse error. Falling back to local NLP.', { component: 'TriageService', error: parseError });
    return localClinicalNLPFallback(transcript, calendarCtx, conversationHistory);
  }
}
