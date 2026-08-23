import { Diagnostics } from '@/lib/diagnostics';
import { clinicStore } from '@/lib/services/clinic-store';

export interface NegotiationInput {
  patient_message: string;
  open_slot: {
    appointment_id: string;
    start_time: string;
    display_time: string;
    service_type: string;
  };
  patient_name?: string;
  patient_phone?: string;
}

export interface NegotiationResult {
  wants_slot: boolean;
  intent: 'accept_slot' | 'decline_slot' | 'hallucination_redirect' | 'inquiry';
  reason: string;
  reply_message: string;
  executed_tool_call?: {
    tool_name: string;
    success: boolean;
    appointment_id: string;
    status: string;
  };
}

/**
 * AI Negotiation & Strict Hallucination Prevention Engine
 * Validates conversational responses against grounded open slot times.
 */
export async function processNegotiation(input: NegotiationInput): Promise<NegotiationResult> {
  const text = (input.patient_message || '').toLowerCase().trim();
  const slot = input.open_slot;

  // 1. Acceptance Detection
  const isAcceptance = 
    text.includes("i'll take it") ||
    text.includes("ill take it") ||
    text.includes("yeah") ||
    text.includes("yes") ||
    text.includes("sure") ||
    text.includes("book me") ||
    text.includes("confirm") ||
    text.includes("count me in") ||
    text.includes("sounds good") ||
    text.includes("accept");

  // 2. Decline Detection
  const isDecline =
    text.includes("no") ||
    text.includes("can't make it") ||
    text.includes("cant make it") ||
    text.includes("pass") ||
    text.includes("decline") ||
    text.includes("give it to someone else") ||
    text.includes("too late") ||
    text.includes("too early");

  // 3. Hallucination Detection (Checking for unavailable dates/times)
  const isAskingOtherTime =
    text.includes("friday") ||
    text.includes("tomorrow") ||
    text.includes("next week") ||
    text.includes("monday") ||
    text.includes("weekend") ||
    text.includes("morning instead") ||
    text.includes("5 pm") ||
    text.includes("different time");

  // A. If asking for hallucinated / nonexistent slot -> Grounded Polite Redirection
  if (isAskingOtherTime && !isAcceptance) {
    const reply = `I understand you are looking for another time, but we currently only have today's ${slot.display_time || 'open'} slot for ${slot.service_type || 'your appointment'}. Would you like me to lock this ${slot.display_time} slot, or keep you on the priority waitlist for future openings?`;
    
    return {
      wants_slot: false,
      intent: 'hallucination_redirect',
      reason: 'Patient requested time/day outside available recovery slot. Grounded redirection triggered.',
      reply_message: reply,
    };
  }

  // B. If declining the slot
  if (isDecline && !isAcceptance) {
    return {
      wants_slot: false,
      intent: 'decline_slot',
      reason: 'Patient explicitly declined the slot offer.',
      reply_message: `No problem at all! We will offer this slot to the next patient in line. You remain active on our waitlist for future openings.`,
    };
  }

  // C. If accepting the slot -> Execute Atomic Database Lock Tool Call
  if (isAcceptance) {
    const claimantName = input.patient_name || 'Confirmed Claimant';
    const claimantPhone = input.patient_phone || '+1 (555) 000-0000';

    const claimResult = clinicStore.claimAppointmentAtomic(
      slot.appointment_id,
      claimantName,
      claimantPhone
    );

    if (claimResult.success) {
      return {
        wants_slot: true,
        intent: 'accept_slot',
        reason: 'Patient confirmed acceptance. Atomic pessimistic database lock executed.',
        reply_message: `Great! You are confirmed for today's ${slot.display_time} ${slot.service_type} slot. Your appointment has been locked in the clinic system.`,
        executed_tool_call: {
          tool_name: 'claim_recovery_slot',
          success: true,
          appointment_id: slot.appointment_id,
          status: 'recovered',
        },
      };
    } else {
      return {
        wants_slot: true,
        intent: 'accept_slot',
        reason: `Slot contention: ${claimResult.error}`,
        reply_message: `I'm sorry, but that ${slot.display_time} slot was just claimed by another patient moments ago. You remain #1 on our priority queue for the next opening.`,
        executed_tool_call: {
          tool_name: 'claim_recovery_slot',
          success: false,
          appointment_id: slot.appointment_id,
          status: 'contention_error',
        },
      };
    }
  }

  // D. General inquiry
  return {
    wants_slot: false,
    intent: 'inquiry',
    reason: 'Unstructured question regarding the slot offer.',
    reply_message: `We have an immediate opening at ${slot.display_time} for ${slot.service_type}. Reply YES to claim it immediately, or NO to pass.`,
  };
}
