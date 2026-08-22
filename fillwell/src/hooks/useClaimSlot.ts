import { useState } from 'react';
import { Diagnostics } from '@/lib/diagnostics';
import { toast } from 'sonner';

interface ClaimSlotVariables {
  appointmentId: string;
  waitlistEntryId: string;
  recoveryEventId: string;
}

/**
 * Resilient mutation hook for claiming slots.
 * Enforces strict pre-conditions, atomic locking, and high-contrast error alerts.
 */
export function useClaimSlot() {
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const claimSlot = async (variables: ClaimSlotVariables) => {
    try {
      setIsClaiming(true);
      setError(null);

      // Pre-flight assertion: Never fire a mutation with invalid state
      Diagnostics.invariant(
        !!variables.appointmentId,
        'claimSlot requires a valid appointmentId',
        { component: 'useClaimSlot' }
      );
      Diagnostics.invariant(
        !!variables.waitlistEntryId,
        'claimSlot requires a valid waitlistEntryId',
        { component: 'useClaimSlot' }
      );
      Diagnostics.invariant(
        !!variables.recoveryEventId,
        'claimSlot requires a valid recoveryEventId',
        { component: 'useClaimSlot' }
      );

      const response = await fetch('/api/recovery/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'force_assign',
          recovery_event_id: variables.recoveryEventId,
          walk_in_patient_name: `Waitlist Patient (${variables.waitlistEntryId})`,
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        const errorMsg = resData.error || `Failed to claim slot (${response.status})`;
        
        // High-contrast toast notification for Slot Contention / Race Condition
        if (response.status === 409 || resData.code === 'SLOT_CONTENTION_ALREADY_CLAIMED') {
          toast.error('Slot Contention / Already Claimed', {
            description: errorMsg,
            duration: 6000,
          });
        } else {
          toast.error('Mutation Failed', {
            description: errorMsg,
            duration: 5000,
          });
        }
        
        throw new Error(errorMsg);
      }

      toast.success('Slot Claimed Successfully', {
        description: `Appointment ${variables.appointmentId} locked and confirmed.`,
      });

      Diagnostics.info('Slot successfully claimed via strict mutation', { component: 'useClaimSlot', variables });
      
      // Dispatch custom event to trigger refetches in other components without strict coupling
      window.dispatchEvent(new CustomEvent('fillwell-slot-claimed'));

      return true;
    } catch (err: any) {
      setError(err);
      // Surface telemetry alert for mutation failure. No silent failures.
      Diagnostics.error('Slot claim mutation failed', { component: 'useClaimSlot', variables }, err);
      return false;
    } finally {
      setIsClaiming(false);
    }
  };

  return {
    claimSlot,
    isClaiming,
    error,
  };
}
