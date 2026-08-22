import { useState, useEffect, useCallback, useRef } from 'react';
import { Diagnostics } from '@/lib/diagnostics';
import { Appointment } from '@/lib/types/database';
import { supabase } from '@/lib/supabase/client';

/**
 * Resilient hook to fetch and subscribe to live appointments.
 * Implements Supabase Realtime Postgres Changes, Optimistic Rollbacks, and Fail-Fast telemetry.
 */
export function useAppointments(providerId: string = 'all') {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Previous snapshot for Optimistic Rollback
  const previousStateRef = useRef<Appointment[]>([]);

  const fetchAppointments = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = providerId && providerId !== 'all' 
        ? `/api/appointments?provider_id=${providerId}` 
        : '/api/appointments';

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch appointments: ${response.statusText}`);
      }

      const resData = await response.json();
      const list = resData.data || (Array.isArray(resData) ? resData : []);

      setAppointments(list);
      previousStateRef.current = list;
      setError(null);
    } catch (err: any) {
      setError(err);
      Diagnostics.error('Failed to load appointments in useAppointments', { component: 'useAppointments', providerId }, err);
    } finally {
      setIsLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    fetchAppointments();

    // 1. Supabase Realtime Postgres Changes Listener (Instant UI Sync)
    const channel = supabase
      .channel('realtime-appointments-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          Diagnostics.info('Supabase Realtime Postgres Change received', { component: 'useAppointments', payload });
          
          if (payload.eventType === 'INSERT') {
            const newApt = payload.new as Appointment;
            setAppointments((prev) => {
              const updated = [newApt, ...prev.filter((a) => a.id !== newApt.id)];
              previousStateRef.current = updated;
              return updated;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedApt = payload.new as Appointment;
            setAppointments((prev) => {
              const updated = prev.map((a) => (a.id === updatedApt.id ? { ...a, ...updatedApt } : a));
              previousStateRef.current = updated;
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            setAppointments((prev) => {
              const updated = prev.filter((a) => a.id !== (payload.old as any).id);
              previousStateRef.current = updated;
              return updated;
            });
          }
        }
      )
      .subscribe();

    // 2. Custom Client/Internal Sync Listener
    const handleSyncEvent = () => {
      fetchAppointments();
    };

    window.addEventListener('fillwell-slot-claimed', handleSyncEvent);
    window.addEventListener('fillwell-appointment-updated', handleSyncEvent);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('fillwell-slot-claimed', handleSyncEvent);
      window.removeEventListener('fillwell-appointment-updated', handleSyncEvent);
    };
  }, [fetchAppointments]);

  // 3. Optimistic Update with Guaranteed Rollback
  const applyOptimisticStatus = useCallback((appointmentId: string, optimisticStatus: Appointment['status'], claimantName?: string) => {
    // Save current snapshot
    previousStateRef.current = [...appointments];

    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === appointmentId
          ? {
              ...apt,
              status: optimisticStatus,
              recovered_by_patient_name: claimantName || apt.recovered_by_patient_name,
            }
          : apt
      )
    );

    // Return a rollback function to be invoked on mutation failure
    return () => {
      Diagnostics.warn(`Rolling back optimistic update for appointment ${appointmentId}`, { component: 'useAppointments' });
      setAppointments([...previousStateRef.current]);
    };
  }, [appointments]);

  return {
    appointments,
    isLoading,
    error,
    refetch: fetchAppointments,
    applyOptimisticStatus,
  };
}
