export type AppointmentStatus =
  | 'confirmed'
  | 'cancelled'
  | 'recovering'
  | 'recovered'
  | 'no_show'
  | 'completed';

export type UrgencyTier = 'routine' | 'moderate' | 'urgent';

export type RecoveryStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'expired'
  | 'force_assigned';

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'timeout';

export interface Clinic {
  id: string;
  name: string;
  phone?: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface OperatingHours {
  [day: string]: {
    start: string;
    end: string;
    is_closed?: boolean;
  };
}

export interface Provider {
  id: string;
  clinic_id: string;
  name: string;
  specialty: string;
  email?: string | null;
  phone?: string | null;
  operating_hours: OperatingHours;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  clinic_id: string;
  provider_id: string | null;
  patient_name: string;
  patient_phone: string;
  patient_email?: string | null;
  start_time: string;
  end_time: string;
  service_type: string;
  status: AppointmentStatus;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  recovered_at?: string | null;
  recovered_by_patient_name?: string | null;
  token_number?: string;
  estimated_wait_mins?: number;
  queue_position?: number;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  provider?: Provider | null;
}

export interface WaitlistEntry {
  id: string;
  clinic_id: string;
  provider_id: string | null;
  patient_name: string;
  patient_phone: string;
  token_number?: string;
  estimated_wait_mins?: number;
  queue_position?: number;
  urgency_tier: UrgencyTier;
  preferred_time_windows: string[]; // e.g. ['mornings', 'afternoons']
  preferred_days: string[]; // e.g. ['monday', 'wednesday']
  waitlist_joined_at: string;
  is_active: boolean;
  priority_score: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  provider?: Provider | null;
}

export interface RecoveryOffer {
  id: string;
  recovery_event_id: string;
  waitlist_entry_id: string | null;
  patient_name: string;
  patient_phone: string;
  offer_sent_at: string;
  expires_at: string;
  response_status: OfferStatus;
  response_text?: string | null;
  responded_at?: string | null;
  channel: 'sms' | 'whatsapp' | 'call';
  created_at: string;
}

export interface RecoveryEvent {
  id: string;
  clinic_id: string;
  appointment_id: string;
  wave_number: number;
  status: RecoveryStatus;
  current_wave_candidates: number;
  wave_started_at: string;
  expires_at: string;
  is_paused: boolean;
  manual_override_reason?: string | null;
  created_at: string;
  updated_at: string;
  appointment?: Appointment | null;
  offers?: RecoveryOffer[];
}

export interface AuditLog {
  id: string;
  clinic_id: string;
  appointment_id?: string | null;
  recovery_event_id?: string | null;
  entity_type: string;
  entity_id: string;
  event_type: string;
  payload: {
    intent?: string;
    confidence?: number;
    atomic_lock_status?: string;
    raw_message?: string;
    response?: string;
    action?: string;
    reason?: string;
    candidates_targeted?: string[];
    details?: Record<string, any>;
    timestamp?: string;
    [key: string]: any;
  };
  created_at: string;
}

export interface ClinicSettings {
  id: string;
  clinic_id: string;
  twilio_status: 'connected' | 'degraded' | 'offline';
  whatsapp_status: 'connected' | 'degraded' | 'offline';
  webhook_url?: string | null;
  quiet_hours_start: string; // '21:00:00'
  quiet_hours_end: string; // '08:00:00'
  wave_size: number;
  wave_timeout_mins: number;
  auto_recovery_enabled: boolean;
  simulated_date_time?: string | null;
  created_at: string;
  updated_at: string;
}
