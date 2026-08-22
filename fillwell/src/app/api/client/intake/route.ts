import { NextRequest, NextResponse } from 'next/server';
import { clinicStore } from '@/lib/services/clinic-store';
import { analyzePatientTranscript } from '@/lib/services/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, channel = 'voice', ticket_id, action } = body;

    // Handle quick ticket actions (reschedule, cancel)
    if (action === 'delay' && ticket_id) {
      const existing = clinicStore.getAppointments().find((a) => a.id === ticket_id);
      if (existing) {
        const start = new Date(existing.start_time);
        start.setMinutes(start.getMinutes() + (body.minutes || 15));
        existing.start_time = start.toISOString();
      }
      return NextResponse.json({
        success: true,
        message: `Appointment delayed by +${body.minutes || 15} minutes.`,
        ticket_id,
      });
    }

    if (action === 'cancel' && ticket_id) {
      clinicStore.updateAppointmentStatus(ticket_id, 'cancelled', 'Cancelled by client via self-service.');
      return NextResponse.json({
        success: true,
        message: 'Appointment cancelled.',
        ticket_id,
      });
    }

    // Call REAL Gemini Triage Parser
    const triage = await analyzePatientTranscript(message || '');
    
    // Use Gemini output to populate the database
    let patient_name = triage.patient_name || 'Caller';
    let urgency = triage.urgency_tier;
    let priority_score = triage.priority_score;
    let service_type = triage.service_type;

    // Register REAL appointment in clinic store so it appears on Dashboard immediately
    const providers = clinicStore.getProviders();
    const provider = providers[0] || null;

    const aptTime = new Date();
    aptTime.setMinutes(aptTime.getMinutes() + (priority_score >= 4 ? 12 : 25));

    const newApt = clinicStore.createAppointment({
      patient_name,
      patient_phone: '+1 (555) ' + Math.floor(100 + Math.random() * 900) + '-' + Math.floor(1000 + Math.random() * 9000),
      service_type,
      start_time: aptTime.toISOString(),
      provider_id: provider ? provider.id : null,
      status: 'confirmed',
    });

    // Calculate queue wait time based on live queue
    const liveQueueLength = clinicStore.getAppointments().filter((a) => a.status === 'confirmed').length;
    const estimatedWaitMins = Math.max(
      4,
      Math.round((liveQueueLength / 3) * 14 * (1.0 - (priority_score - 1) * 0.15))
    );

    return NextResponse.json({
      success: true,
      ticket_id: newApt.id,
      ticket_number: `T-${newApt.id.replace('apt-', '')}`,
      patient_name,
      service_type,
      urgency_tier: urgency,
      priority_score,
      estimated_wait_mins: estimatedWaitMins,
      start_time: newApt.start_time,
      reply_message: `Confirmed! Your ${urgency.toUpperCase()} request is triaged. Ticket #${newApt.id.replace('apt-', '')} issued with ~${estimatedWaitMins} mins wait.`,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
