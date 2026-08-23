import {
  Appointment,
  Provider,
  WaitlistEntry,
  RecoveryEvent,
  RecoveryOffer,
  AuditLog,
  ClinicSettings,
  AppointmentStatus,
  UrgencyTier,
} from '../types/database';

export const DEFAULT_CLINIC_ID = '00000000-0000-0000-0000-000000000001';

export interface OrganizationProfile {
  id: string;
  name: string;
  industry: string;
  active_counters: number;
  base_service_time_mins: number;
  operating_hours_start: string;
  operating_hours_end: string;
  ai_persona_tone: string;
  google_calendar_connected: boolean;
  twilio_connected: boolean;
  vapi_connected: boolean;
  created_at: string;
}

class ClinicDataStore {
  private providers: Map<string, Provider> = new Map();
  private appointments: Map<string, Appointment> = new Map();
  private waitlist: Map<string, WaitlistEntry> = new Map();
  private recoveryEvents: Map<string, RecoveryEvent> = new Map();
  private recoveryOffers: Map<string, RecoveryOffer> = new Map();
  private auditLogs: AuditLog[] = [];
  private settings: ClinicSettings;
  private organization: OrganizationProfile;

  constructor() {
    this.organization = {
      id: DEFAULT_CLINIC_ID,
      name: "Metro Health & Urgent Care",
      industry: "Healthcare & Emergency Clinic",
      active_counters: 3,
      base_service_time_mins: 14.0,
      operating_hours_start: "08:00",
      operating_hours_end: "18:00",
      ai_persona_tone: "Empathetic, Clinical & Prioritized",
      google_calendar_connected: true,
      twilio_connected: true,
      vapi_connected: true,
      created_at: new Date().toISOString(),
    };

    this.settings = {
      id: 'sett-1',
      clinic_id: DEFAULT_CLINIC_ID,
      twilio_status: 'connected',
      whatsapp_status: 'connected',
      webhook_url: 'https://fillwell.api/webhooks/inbound',
      quiet_hours_start: '21:00:00',
      quiet_hours_end: '08:00:00',
      wave_size: 3,
      wave_timeout_mins: 5,
      auto_recovery_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Initialize with 1 default provider for clean setup
    this.providers.set('prov-1', {
      id: 'prov-1',
      clinic_id: DEFAULT_CLINIC_ID,
      name: 'Dr. Sarah Lin, MD',
      specialty: 'Clinical Practitioner',
      email: 's.lin@fillwellhealth.com',
      phone: '+1 (555) 123-4501',
      operating_hours: {
        monday: { start: '08:00', end: '17:00' },
        tuesday: { start: '08:00', end: '17:00' },
        wednesday: { start: '08:00', end: '17:00' },
        thursday: { start: '08:00', end: '17:00' },
        friday: { start: '08:00', end: '17:00' },
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.seedSandboxDemo();
  }

  // Organization Setup & Profile
  getOrganization(): OrganizationProfile {
    return this.organization;
  }

  updateOrganization(data: Partial<OrganizationProfile>): OrganizationProfile {
    this.organization = {
      ...this.organization,
      ...data,
    };
    return this.organization;
  }

  // Behind the Scenes / Sandbox Demo Seeding (Only triggered explicitly by developer)
  seedSandboxDemo() {
    this.appointments.clear();
    this.waitlist.clear();
    this.recoveryEvents.clear();
    this.recoveryOffers.clear();

    const now = new Date();
    const setTime = (hours: number, mins: number) => {
      const d = new Date(now);
      d.setHours(hours, mins, 0, 0);
      return d.toISOString();
    };

    const p1 = this.providers.get('prov-1')!;

    this.resetSandbox(); // Start from a purely clean state before seeding the dummy schedule

    const a1: Appointment = {
      id: 'apt-vikram',
      clinic_id: DEFAULT_CLINIC_ID,
      provider_id: p1.id,
      patient_name: 'Vikram Singh',
      patient_phone: '+1 (555) 100-0001',
      start_time: setTime(10, 0),
      end_time: setTime(10, 45),
      service_type: 'Orthopedic Consultation',
      status: 'confirmed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      provider: p1,
    };

    const a2: Appointment = {
      id: 'apt-neha',
      clinic_id: DEFAULT_CLINIC_ID,
      provider_id: p1.id,
      patient_name: 'Neha Sharma',
      patient_phone: '+1 (555) 100-0002',
      start_time: setTime(11, 30),
      end_time: setTime(12, 15),
      service_type: 'Physical Therapy',
      status: 'confirmed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      provider: p1,
    };

    const a3: Appointment = {
      id: 'apt-rohan',
      clinic_id: DEFAULT_CLINIC_ID,
      provider_id: p1.id,
      patient_name: 'Rohan Patel',
      patient_phone: '+1 (555) 100-0003',
      start_time: setTime(14, 0),
      end_time: setTime(14, 45),
      service_type: 'Sports Injury Follow-up',
      status: 'confirmed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      provider: p1,
    };

    this.appointments.set(a1.id, a1);
    this.appointments.set(a2.id, a2);
    this.appointments.set(a3.id, a3);

    // Also seed initial standby waitlist candidates for rich simulation
    const w1: WaitlistEntry = {
      id: 'wt-maya',
      clinic_id: DEFAULT_CLINIC_ID,
      provider_id: p1.id,
      patient_name: 'Maya Lin',
      patient_phone: '+1 (555) 200-0011',
      urgency_tier: 'urgent',
      priority_score: 5,
      token_number: 'WL-201',
      preferred_time_windows: ['mornings', 'afternoons'],
      preferred_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      waitlist_joined_at: new Date(Date.now() - 15 * 60000).toISOString(),
      is_active: true,
      notes: 'Acute lower back spasm, needs urgent adjustment',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      provider: p1,
    };

    const w2: WaitlistEntry = {
      id: 'wt-david',
      clinic_id: DEFAULT_CLINIC_ID,
      provider_id: p1.id,
      patient_name: 'David Chen',
      patient_phone: '+1 (555) 200-0012',
      urgency_tier: 'moderate',
      priority_score: 3,
      token_number: 'WL-202',
      preferred_time_windows: ['afternoons'],
      preferred_days: ['monday', 'wednesday', 'friday'],
      waitlist_joined_at: new Date(Date.now() - 30 * 60000).toISOString(),
      is_active: true,
      notes: 'Follow-up on post-operative knee swelling',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      provider: p1,
    };

    this.waitlist.set(w1.id, w1);
    this.waitlist.set(w2.id, w2);
  }

  resetSandbox() {
    this.appointments.clear();
    this.waitlist.clear();
    this.recoveryEvents.clear();
    this.recoveryOffers.clear();
    this.auditLogs = [];
  }

  // Provider methods
  getProviders(): Provider[] {
    return Array.from(this.providers.values()).filter((p) => p.is_active);
  }

  createProvider(data: Partial<Provider>): Provider {
    const id = `prov-${Date.now()}`;
    const prov: Provider = {
      id,
      clinic_id: DEFAULT_CLINIC_ID,
      name: data.name || 'Clinician',
      specialty: data.specialty || 'General Practice',
      email: data.email || null,
      phone: data.phone || null,
      operating_hours: data.operating_hours || {
        monday: { start: '08:00', end: '17:00' },
        tuesday: { start: '08:00', end: '17:00' },
        wednesday: { start: '08:00', end: '17:00' },
        thursday: { start: '08:00', end: '17:00' },
        friday: { start: '08:00', end: '17:00' },
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.providers.set(id, prov);
    return prov;
  }

  // Appointment methods with Dynamic Wait Times & Tokens
  getAppointments(providerId?: string | null): Appointment[] {
    const activeCounters = Math.max(1, this.organization.active_counters || 2);
    const baseServiceTime = this.organization.base_service_time_mins || 12.0;

    let list = Array.from(this.appointments.values()).map((apt, index) => {
      const tokenNumber = apt.token_number || `TK-${(index + 101).toString()}`;
      return {
        ...apt,
        token_number: tokenNumber,
        provider: apt.provider_id ? this.providers.get(apt.provider_id) || null : null,
      };
    });

    if (providerId && providerId !== 'all') {
      list = list.filter((apt) => apt.provider_id === providerId);
    }

    list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    let activeAhead = 0;
    return list.map((apt) => {
      if (apt.status === 'completed' || apt.status === 'cancelled') {
        return { ...apt, queue_position: 0, estimated_wait_mins: 0 };
      }
      const position = activeAhead;
      activeAhead += 1;
      const wait = Math.max(2, Math.round((position / activeCounters) * baseServiceTime));
      return {
        ...apt,
        queue_position: position + 1,
        estimated_wait_mins: wait,
      };
    });
  }

  getAppointmentById(id: string): Appointment | null {
    const apt = this.appointments.get(id);
    if (!apt) return null;
    return {
      ...apt,
      provider: apt.provider_id ? this.providers.get(apt.provider_id) || null : null,
    };
  }

  createAppointment(data: Partial<Appointment>): Appointment {
    const id = `apt-${Date.now()}`;
    const apt: Appointment = {
      id,
      clinic_id: DEFAULT_CLINIC_ID,
      provider_id: data.provider_id || null,
      patient_name: data.patient_name || 'Patient',
      patient_phone: data.patient_phone || '+15550000000',
      patient_email: data.patient_email || null,
      start_time: data.start_time || new Date().toISOString(),
      end_time: data.end_time || new Date(Date.now() + 1800000).toISOString(),
      service_type: data.service_type || 'Consultation',
      status: (data.status as AppointmentStatus) || 'confirmed',
      token_number: `TK-${Math.floor(100 + Math.random() * 900)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.appointments.set(id, apt);
    return apt;
  }

  updateAppointmentStatus(id: string, status: AppointmentStatus, reason?: string): Appointment | null {
    const apt = this.appointments.get(id);
    if (!apt) return null;

    apt.status = status;
    apt.updated_at = new Date().toISOString();

    if (status === 'cancelled' || status === 'recovering') {
      apt.cancelled_at = new Date().toISOString();
      apt.cancellation_reason = reason || 'Cancelled by operator.';
      this.triggerSlotRecovery(apt.id);
    } else if (status === 'recovered') {
      apt.recovered_at = new Date().toISOString();
    } else if (status === 'completed') {
      apt.completed_at = new Date().toISOString();
      this.auditLogs.unshift({
        id: `log-${Date.now()}`,
        clinic_id: DEFAULT_CLINIC_ID,
        appointment_id: apt.id,
        entity_type: 'appointment',
        entity_id: apt.id,
        event_type: 'patient_consultation_completed',
        payload: {
          patient_name: apt.patient_name,
          service_type: apt.service_type,
          token_number: apt.token_number || 'TK-101',
          completed_at: apt.completed_at,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    }

    return apt;
  }

  claimAppointment(
    appointmentId: string,
    patientName: string,
    patientPhone?: string,
    channel: string = 'live_standby'
  ): { success: boolean; appointment?: Appointment; error?: string } {
    const apt = this.appointments.get(appointmentId);
    if (!apt) {
      return { success: false, error: 'Appointment not found.' };
    }

    if (apt.status === 'recovered' || apt.status === 'confirmed') {
      return {
        success: false,
        error: `Slot Contention: This appointment has already been claimed by ${apt.recovered_by_patient_name || apt.patient_name}.`,
      };
    }

    // Atomic pessimistic update
    apt.status = 'recovered';
    apt.patient_name = patientName;
    apt.patient_phone = patientPhone || apt.patient_phone;
    apt.recovered_at = new Date().toISOString();
    apt.recovered_by_patient_name = patientName;
    apt.updated_at = new Date().toISOString();

    // Close any active recovery events for this appointment
    Array.from(this.recoveryEvents.values()).forEach((r) => {
      if (r.appointment_id === appointmentId && (r.status === 'active' || r.status === 'paused')) {
        r.status = 'completed';
        r.updated_at = new Date().toISOString();
      }
    });

    // Cull waitlist for this patient if present
    Array.from(this.waitlist.values()).forEach((w) => {
      if (
        w.patient_name.toLowerCase() === patientName.toLowerCase() ||
        (patientPhone && w.patient_phone === patientPhone)
      ) {
        w.is_active = false;
        w.updated_at = new Date().toISOString();
      }
    });

    // Write Immutable Audit Log
    this.auditLogs.unshift({
      id: `log-${Date.now()}`,
      clinic_id: DEFAULT_CLINIC_ID,
      appointment_id: appointmentId,
      entity_type: 'appointment',
      entity_id: appointmentId,
      event_type: 'slot_atomic_locked_claimed',
      payload: {
        tool_call: 'claim_appointment',
        claimed_by: patientName,
        phone: patientPhone || apt.patient_phone,
        channel,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    return { success: true, appointment: apt };
  }

  // Waitlist methods
  getWaitlist(providerId?: string | null): WaitlistEntry[] {
    let list = Array.from(this.waitlist.values())
      .filter((w) => w.is_active)
      .map((w) => ({
        ...w,
        provider: w.provider_id ? this.providers.get(w.provider_id) || null : null,
      }));

    if (providerId && providerId !== 'all') {
      list = list.filter((w) => !w.provider_id || w.provider_id === providerId);
    }

    const urgencyWeight: Record<UrgencyTier, number> = { urgent: 3, moderate: 2, routine: 1 };
    list.sort((a, b) => {
      const diff = urgencyWeight[b.urgency_tier] - urgencyWeight[a.urgency_tier];
      if (diff !== 0) return diff;
      return b.priority_score - a.priority_score;
    });

    const activeCounters = Math.max(1, this.organization.active_counters || 2);
    const baseServiceTime = this.organization.base_service_time_mins || 12.0;

    return list.map((item, idx) => {
      const tokenNumber = item.token_number || `WL-${(idx + 201).toString()}`;
      const priorityFactor = Math.max(0.3, 1.0 - (item.priority_score - 1) * 0.15);
      const wait = Math.max(2, Math.round((idx / activeCounters) * baseServiceTime * priorityFactor));

      return {
        ...item,
        token_number: tokenNumber,
        queue_position: idx + 1,
        estimated_wait_mins: wait,
      };
    });
  }

  createWaitlistEntry(data: Partial<WaitlistEntry>): WaitlistEntry {
    const id = `wt-${Date.now()}`;
    const tokenNumber = data.token_number || `WL-${Math.floor(200 + Math.random() * 800)}`;
    const entry: WaitlistEntry = {
      id,
      clinic_id: DEFAULT_CLINIC_ID,
      provider_id: data.provider_id || null,
      patient_name: data.patient_name || '',
      patient_phone: data.patient_phone || '',
      token_number: tokenNumber,
      urgency_tier: data.urgency_tier || 'routine',
      preferred_time_windows: data.preferred_time_windows || ['mornings'],
      preferred_days: data.preferred_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      waitlist_joined_at: new Date().toISOString(),
      is_active: true,
      priority_score: data.urgency_tier === 'urgent' ? 5 : data.urgency_tier === 'moderate' ? 3 : 1,
      notes: data.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      provider: data.provider_id ? this.providers.get(data.provider_id) || null : null,
    };
    this.waitlist.set(id, entry);

    // Write Immutable Audit Log
    this.auditLogs.unshift({
      id: `log-${Date.now()}`,
      clinic_id: DEFAULT_CLINIC_ID,
      entity_type: 'waitlist',
      entity_id: id,
      event_type: 'patient_waitlist_registered',
      payload: {
        patient_name: entry.patient_name,
        phone: entry.patient_phone,
        urgency: entry.urgency_tier,
        priority_score: entry.priority_score,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    return entry;
  }

  bumpWaitlistPriority(id: string): WaitlistEntry | null {
    const entry = this.waitlist.get(id);
    if (!entry) return null;
    entry.priority_score += 1;
    if (entry.urgency_tier === 'routine') entry.urgency_tier = 'moderate';
    else if (entry.urgency_tier === 'moderate') entry.urgency_tier = 'urgent';
    entry.updated_at = new Date().toISOString();
    return entry;
  }

  deleteWaitlistEntry(id: string): boolean {
    return this.waitlist.delete(id);
  }

  // Recovery & Override methods
  getActiveRecoveryEvents(): RecoveryEvent[] {
    return Array.from(this.recoveryEvents.values())
      .filter((r) => r.status === 'active' || r.status === 'paused')
      .map((r) => ({
        ...r,
        appointment: this.appointments.get(r.appointment_id) || null,
        offers: Array.from(this.recoveryOffers.values()).filter((o) => o.recovery_event_id === r.id),
      }));
  }

  isQuietHours(customDate?: Date): boolean {
    const now = customDate || new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTimeVal = currentHour * 60 + currentMin;

    const [startH, startM] = (this.settings.quiet_hours_start || '21:00').split(':').map(Number);
    const [endH, endM] = (this.settings.quiet_hours_end || '08:00').split(':').map(Number);

    const startVal = startH * 60 + (startM || 0);
    const endVal = endH * 60 + (endM || 0);

    // If quiet hours span midnight (e.g. 21:00 to 08:00)
    if (startVal > endVal) {
      return currentTimeVal >= startVal || currentTimeVal < endVal;
    }
    return currentTimeVal >= startVal && currentTimeVal < endVal;
  }

  triggerSlotRecovery(appointmentId: string, simulateDate?: Date): RecoveryEvent {
    const id = `rec-${Date.now()}`;
    const apt = this.appointments.get(appointmentId);
    const now = simulateDate || new Date();
    const inQuietHours = this.isQuietHours(now);

    let waveStartedAt = now.toISOString();
    let expiresAt: string;
    let waveStatus: RecoveryEvent['status'] = 'active';

    if (inQuietHours) {
      waveStatus = 'paused'; // Queued for morning
      // Schedule for next 8:00 AM
      const morningDate = new Date(now);
      if (now.getHours() >= 21) {
        morningDate.setDate(morningDate.getDate() + 1);
      }
      morningDate.setHours(8, 0, 0, 0);
      waveStartedAt = morningDate.toISOString();
      expiresAt = new Date(morningDate.getTime() + this.settings.wave_timeout_mins * 60000).toISOString();
    } else {
      expiresAt = new Date(now.getTime() + this.settings.wave_timeout_mins * 60000).toISOString();
    }

    const waveEvent: RecoveryEvent = {
      id,
      clinic_id: DEFAULT_CLINIC_ID,
      appointment_id: appointmentId,
      wave_number: 1,
      status: waveStatus,
      current_wave_candidates: this.settings.wave_size,
      wave_started_at: waveStartedAt,
      expires_at: expiresAt,
      is_paused: inQuietHours,
      manual_override_reason: inQuietHours ? 'Quiet hours active. Dispatch queued for 08:00 AM.' : undefined,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      appointment: apt || null,
    };

    if (apt) {
      apt.status = 'recovering';
    }

    this.recoveryEvents.set(id, waveEvent);

    // Prioritized Queue Execution: Strictly Top-N candidates by Urgency & Priority Score
    const urgencyWeight = { urgent: 3, moderate: 2, routine: 1 };
    const candidates = this.getWaitlist(apt?.provider_id)
      .sort((a, b) => {
        const uA = urgencyWeight[a.urgency_tier] || 1;
        const uB = urgencyWeight[b.urgency_tier] || 1;
        if (uA !== uB) return uB - uA; // Higher urgency first
        return (b.priority_score || 1) - (a.priority_score || 1); // Higher score first
      })
      .slice(0, this.settings.wave_size);

    candidates.forEach((cand, idx) => {
      const offerId = `off-${Date.now()}-${idx}`;
      const offer: RecoveryOffer = {
        id: offerId,
        recovery_event_id: id,
        waitlist_entry_id: cand.id,
        patient_name: cand.patient_name,
        patient_phone: cand.patient_phone,
        offer_sent_at: inQuietHours ? waveStartedAt : now.toISOString(),
        expires_at: expiresAt,
        response_status: 'pending',
        channel: idx % 2 === 0 ? 'sms' : 'whatsapp',
        created_at: now.toISOString(),
      };
      this.recoveryOffers.set(offerId, offer);
    });

    this.auditLogs.unshift({
      id: `log-${Date.now()}`,
      clinic_id: DEFAULT_CLINIC_ID,
      appointment_id: appointmentId,
      recovery_event_id: id,
      entity_type: 'recovery_event',
      entity_id: id,
      event_type: inQuietHours ? 'quiet_hours_delayed_until_morning' : 'wave_1_dispatched',
      payload: {
        intent: 'automated_wave_dispatch',
        quiet_hours_active: inQuietHours,
        scheduled_for: waveStartedAt,
        candidates_targeted: candidates.map((c) => c.patient_name),
        timestamp: now.toISOString(),
      },
      created_at: now.toISOString(),
    });

    return waveEvent;
  }

  // Loop Closure: Notify all unselected candidates that slot was filled
  closeRecoveryLoop(recoveryEventId: string, winningPatientName: string): { closed_count: number; recipients: string[] } {
    const recipients: string[] = [];
    let count = 0;

    for (const [oId, offer] of Array.from(this.recoveryOffers.entries())) {
      if (offer.recovery_event_id === recoveryEventId && offer.response_status === 'pending') {
        if (offer.patient_name.toLowerCase() !== winningPatientName.toLowerCase()) {
          offer.response_status = 'declined';
          offer.response_text = 'Slot claimed by another candidate. Loop closed.';
          offer.responded_at = new Date().toISOString();
          recipients.push(offer.patient_name);
          count++;
        }
      }
    }

    this.auditLogs.unshift({
      id: `log-${Date.now()}`,
      clinic_id: DEFAULT_CLINIC_ID,
      recovery_event_id: recoveryEventId,
      entity_type: 'recovery_loop',
      entity_id: recoveryEventId,
      event_type: 'loop_closure_dispatched',
      payload: {
        message: 'Slot filled by claimant. Closure notices dispatched to remaining candidates.',
        winning_claimant: winningPatientName,
        notified_candidates: recipients,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    return { closed_count: count, recipients };
  }

  handleRecoveryOverride(
    eventId: string,
    action: 'pause' | 'resume' | 'next_wave' | 'force_assign',
    walkInName?: string,
    walkInPhone?: string
  ): RecoveryEvent | null {
    const event = this.recoveryEvents.get(eventId);
    if (!event) return null;

    if (action === 'pause') {
      event.status = 'paused';
      event.is_paused = true;
    } else if (action === 'resume') {
      event.status = 'active';
      event.is_paused = false;
    } else if (action === 'next_wave') {
      event.wave_number += 1;
      event.status = 'active';
      event.is_paused = false;
      event.wave_started_at = new Date().toISOString();
      event.expires_at = new Date(Date.now() + this.settings.wave_timeout_mins * 60000).toISOString();
    } else if (action === 'force_assign') {
      event.status = 'force_assigned';
      const apt = this.appointments.get(event.appointment_id);
      if (apt) {
        apt.status = 'recovered';
        apt.recovered_at = new Date().toISOString();
        apt.recovered_by_patient_name = walkInName || 'Walk-in Patient (Manual Override)';
        if (walkInPhone) apt.patient_phone = walkInPhone;
      }
    }

    event.updated_at = new Date().toISOString();
    return event;
  }

  // Atomic Pessimistic Slot Claim Engine
  claimAppointmentAtomic(
    appointmentId: string,
    patientName: string,
    patientPhone: string,
    recoveryEventId?: string
  ): { success: boolean; appointment?: Appointment; error?: string; code?: string } {
    const apt = this.appointments.get(appointmentId);
    if (!apt) {
      return { success: false, error: 'Appointment not found', code: 'NOT_FOUND' };
    }

    // Atomic Contention Check
    if (apt.status === 'recovered') {
      return {
        success: false,
        error: `Slot Contention: This appointment has already been claimed by ${apt.recovered_by_patient_name || 'another patient'}.`,
        code: 'SLOT_CONTENTION_ALREADY_CLAIMED',
      };
    }

    if (apt.status !== 'recovering' && apt.status !== 'cancelled') {
      return {
        success: false,
        error: `Slot Contention: Slot is not open for recovery (Status: ${apt.status}).`,
        code: 'INVALID_STATUS',
      };
    }

    const now = new Date().toISOString();
    apt.status = 'recovered';
    apt.recovered_at = now;
    apt.recovered_by_patient_name = patientName;
    apt.patient_name = patientName;
    apt.patient_phone = patientPhone;
    apt.updated_at = now;

    // Complete Recovery Event & Execute Loop Closure
    let targetRecId = recoveryEventId;
    if (!targetRecId) {
      const activeRec = Array.from(this.recoveryEvents.values()).find(
        (r) => r.appointment_id === appointmentId && (r.status === 'active' || r.status === 'paused')
      );
      if (activeRec) {
        targetRecId = activeRec.id;
      }
    }

    if (targetRecId) {
      const rec = this.recoveryEvents.get(targetRecId);
      if (rec) {
        rec.status = 'force_assigned';
        rec.updated_at = now;
      }
      // Execute Loop Closure: Dispatches "slot filled" notices to all other candidates
      this.closeRecoveryLoop(targetRecId, patientName);
    }

    // Automatic Waitlist Culling: Find matching active waitlist entry and cull it
    let culledEntry = null;
    for (const [wId, entry] of Array.from(this.waitlist.entries())) {
      if (
        entry.is_active &&
        (entry.patient_name.toLowerCase() === patientName.toLowerCase() ||
          (patientPhone && entry.patient_phone === patientPhone))
      ) {
        entry.is_active = false;
        entry.updated_at = now;
        culledEntry = entry;
        break;
      }
    }

    // Write Audit Log
    this.auditLogs.unshift({
      id: `log-${Date.now()}`,
      clinic_id: DEFAULT_CLINIC_ID,
      appointment_id: appointmentId,
      recovery_event_id: targetRecId || null,
      entity_type: 'appointment',
      entity_id: appointmentId,
      event_type: 'slot_atomic_locked_claimed',
      payload: {
        claimed_by: patientName,
        phone: patientPhone,
        waitlist_culled: culledEntry ? culledEntry.id : null,
        loop_closure_executed: Boolean(targetRecId),
        timestamp: now,
      },
      created_at: now,
    });

    return { success: true, appointment: apt };
  }

  // Audit Logs
  getAuditLogs(appointmentId?: string | null): AuditLog[] {
    if (appointmentId) {
      return this.auditLogs.filter((log) => log.appointment_id === appointmentId);
    }
    return this.auditLogs;
  }

  // Settings
  getSettings(): ClinicSettings {
    return this.settings;
  }

  updateSettings(data: Partial<ClinicSettings>): ClinicSettings {
    this.settings = {
      ...this.settings,
      ...data,
      updated_at: new Date().toISOString(),
    };
    return this.settings;
  }
}

declare global {
  var __fillwell_store__: ClinicDataStore | undefined;
}

export const clinicStore = globalThis.__fillwell_store__ || new ClinicDataStore();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__fillwell_store__ = clinicStore;
}
