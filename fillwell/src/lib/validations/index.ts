import { z } from 'zod';

export const phoneRegex = /^(\+?\d{1,4}[\s-]?)?(\(?\d{2,4}\)?[\s-]?)?[\d\s-]{5,15}$/;

export const waitlistFormSchema = z.object({
  patient_name: z
    .string()
    .min(2, { message: 'Patient name must be at least 2 characters.' })
    .max(100, { message: 'Patient name cannot exceed 100 characters.' }),
  patient_phone: z
    .string()
    .regex(phoneRegex, { message: 'Enter a valid E.164 phone number (e.g. +15551234567).' }),
  urgency_tier: z.enum(['routine', 'moderate', 'urgent'], {
    required_error: 'Please select an urgency tier.',
  }),
  provider_id: z.string().nullable().optional(),
  preferred_time_windows: z
    .array(z.string())
    .min(1, { message: 'Select at least one preferred time window.' }),
  preferred_days: z
    .array(z.string())
    .min(1, { message: 'Select at least one preferred day.' }),
  notes: z.string().max(500).optional().nullable(),
});

export type WaitlistFormValues = z.infer<typeof waitlistFormSchema>;

export const appointmentFormSchema = z.object({
  patient_name: z.string().min(2, 'Patient name is required.'),
  patient_phone: z.string().regex(phoneRegex, 'Valid phone number required.'),
  patient_email: z.string().email().optional().nullable().or(z.literal('')),
  provider_id: z.string().min(1, 'Please assign a clinician.'),
  service_type: z.string().min(2, 'Service type is required.'),
  start_time: z.string().min(1, 'Start time is required.'),
  end_time: z.string().min(1, 'End time is required.'),
});

export type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

export const recoveryOverrideSchema = z.object({
  recovery_event_id: z.string().min(1, 'Recovery event ID required.'),
  action: z.enum(['pause', 'resume', 'next_wave', 'force_assign']),
  walk_in_patient_name: z.string().optional(),
  walk_in_patient_phone: z.string().optional(),
  reason: z.string().optional(),
});

export type RecoveryOverrideValues = z.infer<typeof recoveryOverrideSchema>;

export const clinicSettingsSchema = z.object({
  quiet_hours_start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Invalid time format (HH:mm)'),
  quiet_hours_end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Invalid time format (HH:mm)'),
  wave_size: z.number().min(1).max(10),
  wave_timeout_mins: z.number().min(1).max(30),
  auto_recovery_enabled: z.boolean(),
  simulated_date_time: z.string().nullable().optional(),
});

export type ClinicSettingsValues = z.infer<typeof clinicSettingsSchema>;

export const providerFormSchema = z.object({
  name: z.string().min(2, 'Provider name must be at least 2 characters.'),
  specialty: z.string().min(2, 'Specialty is required.'),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  is_active: z.boolean().default(true),
});

export type ProviderFormValues = z.infer<typeof providerFormSchema>;
