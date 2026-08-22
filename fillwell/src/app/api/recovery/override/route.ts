import { NextRequest, NextResponse } from 'next/server';
import { clinicStore } from '@/lib/services/clinic-store';
import { recoveryOverrideSchema } from '@/lib/validations';

export async function GET() {
  try {
    const activeEvents = clinicStore.getActiveRecoveryEvents();
    return NextResponse.json({ success: true, data: activeEvents });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = recoveryOverrideSchema.parse(body);

    if (validated.action === 'force_assign') {
      const activeEvents = clinicStore.getActiveRecoveryEvents();
      const event = activeEvents.find(e => e.id === validated.recovery_event_id);
      
      const aptId = event ? event.appointment_id : validated.recovery_event_id;
      const claimResult = clinicStore.claimAppointmentAtomic(
        aptId,
        validated.walk_in_patient_name || 'Walk-in Claimant',
        validated.walk_in_patient_phone || '+1 (555) 000-0000',
        validated.recovery_event_id
      );

      if (!claimResult.success) {
        return NextResponse.json(
          { 
            success: false, 
            error: claimResult.error || 'Slot Contention: Already Claimed', 
            code: claimResult.code || 'SLOT_CONTENTION_ALREADY_CLAIMED' 
          }, 
          { status: 409 } // 409 Conflict for Race Condition / Contention
        );
      }

      return NextResponse.json({ success: true, data: claimResult.appointment, message: 'Slot claimed atomically.' });
    }

    const updatedEvent = clinicStore.handleRecoveryOverride(
      validated.recovery_event_id,
      validated.action,
      validated.walk_in_patient_name,
      validated.walk_in_patient_phone
    );

    if (!updatedEvent) {
      return NextResponse.json({ success: false, error: 'Recovery event not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedEvent });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error' },
      { status: 400 }
    );
  }
}
