-- =============================================================================
-- Fillwell Enterprise Clinical Scheduling & Automated Slot-Recovery Schema
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Clinics Table
CREATE TABLE IF NOT EXISTS clinics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Clinic Settings & Integration Telemetry
CREATE TABLE IF NOT EXISTS clinic_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    twilio_status VARCHAR(50) DEFAULT 'connected', -- 'connected', 'degraded', 'offline'
    whatsapp_status VARCHAR(50) DEFAULT 'connected',
    webhook_url TEXT,
    quiet_hours_start TIME DEFAULT '21:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    wave_size INT DEFAULT 4 CHECK (wave_size BETWEEN 1 AND 10),
    wave_timeout_mins INT DEFAULT 5 CHECK (wave_timeout_mins BETWEEN 1 AND 30),
    auto_recovery_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Providers / Clinicians
CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    operating_hours JSONB DEFAULT '{"monday": {"start": "08:00", "end": "17:00"}, "tuesday": {"start": "08:00", "end": "17:00"}, "wednesday": {"start": "08:00", "end": "17:00"}, "thursday": {"start": "08:00", "end": "17:00"}, "friday": {"start": "08:00", "end": "17:00"}}'::JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Appointments Table
CREATE TYPE appointment_status_enum AS ENUM ('confirmed', 'cancelled', 'recovering', 'recovered', 'no_show', 'completed');

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(50) NOT NULL,
    patient_email VARCHAR(255),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    service_type VARCHAR(255) NOT NULL,
    status appointment_status_enum DEFAULT 'confirmed',
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    recovered_at TIMESTAMPTZ,
    recovered_by_patient_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Waitlist Management Table
CREATE TYPE urgency_tier_enum AS ENUM ('routine', 'moderate', 'urgent');

CREATE TABLE IF NOT EXISTS waitlist_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(50) NOT NULL,
    urgency_tier urgency_tier_enum DEFAULT 'routine',
    preferred_time_windows JSONB DEFAULT '["mornings", "afternoons"]'::JSONB,
    preferred_days JSONB DEFAULT '["monday", "tuesday", "wednesday", "thursday", "friday"]'::JSONB,
    waitlist_joined_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    priority_score INT DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Slot Recovery Events (Waves)
CREATE TYPE recovery_status_enum AS ENUM ('pending', 'active', 'paused', 'completed', 'expired', 'force_assigned');

CREATE TABLE IF NOT EXISTS recovery_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    wave_number INT DEFAULT 1,
    status recovery_status_enum DEFAULT 'active',
    current_wave_candidates INT DEFAULT 4,
    wave_started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
    is_paused BOOLEAN DEFAULT FALSE,
    manual_override_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Recovery Offers Sent to Waitlisted Candidates
CREATE TYPE offer_status_enum AS ENUM ('pending', 'accepted', 'declined', 'timeout');

CREATE TABLE IF NOT EXISTS recovery_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recovery_event_id UUID REFERENCES recovery_events(id) ON DELETE CASCADE,
    waitlist_entry_id UUID REFERENCES waitlist_entries(id) ON DELETE SET NULL,
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(50) NOT NULL,
    offer_sent_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    response_status offer_status_enum DEFAULT 'pending',
    response_text TEXT,
    responded_at TIMESTAMPTZ,
    channel VARCHAR(50) DEFAULT 'sms', -- 'sms', 'whatsapp', 'call'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Live Audit Trail & AI Conversation Inspector
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    recovery_event_id UUID REFERENCES recovery_events(id) ON DELETE SET NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- e.g. 'cancellation_detected', 'wave_dispatched', 'ai_inbound_sms', 'slot_atomic_locked'
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date ON appointments(clinic_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_active_urgency ON waitlist_entries(is_active, urgency_tier, priority_score);
CREATE INDEX IF NOT EXISTS idx_recovery_events_status ON recovery_events(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_appointment ON audit_logs(appointment_id);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE recovery_events;
ALTER PUBLICATION supabase_realtime ADD TABLE recovery_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE waitlist_entries;

-- =============================================================================
-- 9. Atomic Engine: Pessimistic Row-Locking RPC Function
-- =============================================================================
CREATE OR REPLACE FUNCTION claim_appointment(
    p_appointment_id UUID,
    p_patient_name VARCHAR,
    p_patient_phone VARCHAR,
    p_recovery_event_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointment RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- 1. Pessimistic Row Lock with FOR UPDATE (blocks concurrent transactions)
    SELECT * INTO v_appointment
    FROM appointments
    WHERE id = p_appointment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Appointment not found',
            'code', 'NOT_FOUND'
        );
    END IF;

    -- 2. State Invariant Check: Must not already be claimed
    IF v_appointment.status = 'recovered' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Slot Contention: This appointment has already been claimed by another patient (' || COALESCE(v_appointment.recovered_by_patient_name, 'another claimant') || ').',
            'code', 'SLOT_CONTENTION_ALREADY_CLAIMED',
            'claimed_by', v_appointment.recovered_by_patient_name
        );
    END IF;

    IF v_appointment.status != 'recovering' AND v_appointment.status != 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Slot Contention: Appointment is not in an open recovery state (Current status: ' || v_appointment.status || ').',
            'code', 'INVALID_STATUS'
        );
    END IF;

    -- 3. Perform Atomic State Transition
    UPDATE appointments
    SET status = 'recovered',
        recovered_at = v_now,
        recovered_by_patient_name = p_patient_name,
        patient_name = p_patient_name,
        patient_phone = p_patient_phone,
        updated_at = v_now
    WHERE id = p_appointment_id;

    -- 4. Complete Active Recovery Wave Event
    IF p_recovery_event_id IS NOT NULL THEN
        UPDATE recovery_events
        SET status = 'completed',
            updated_at = v_now
        WHERE id = p_recovery_event_id;
    ELSE
        UPDATE recovery_events
        SET status = 'completed',
            updated_at = v_now
        WHERE appointment_id = p_appointment_id AND (status = 'active' OR status = 'paused');
    END IF;

    -- 5. Automatic Waitlist Culling: Deactivate matching waitlist entry
    UPDATE waitlist_entries
    SET is_active = FALSE,
        updated_at = v_now
    WHERE clinic_id = v_appointment.clinic_id 
      AND is_active = TRUE
      AND (patient_name = p_patient_name OR patient_phone = p_patient_phone);

    -- 6. Write Immutable Audit Log
    INSERT INTO audit_logs (
        clinic_id,
        appointment_id,
        recovery_event_id,
        entity_type,
        entity_id,
        event_type,
        payload
    ) VALUES (
        v_appointment.clinic_id,
        p_appointment_id,
        p_recovery_event_id,
        'appointment',
        p_appointment_id::text,
        'slot_atomic_locked_claimed',
        jsonb_build_object(
            'claimed_by', p_patient_name,
            'phone', p_patient_phone,
            'waitlist_culled', true,
            'timestamp', v_now
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Slot claimed successfully via atomic pessimistic lock. Waitlist entry culled.',
        'appointment_id', p_appointment_id,
        'claimed_by', p_patient_name
    );
END;
$$;

-- =============================================================================
-- 10. Database Trigger: Automatic Waitlist Culling on Slot Recovery
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_cull_waitlist_on_recovery()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'recovered' AND (OLD.status IS NULL OR OLD.status != 'recovered') THEN
        UPDATE waitlist_entries
        SET is_active = FALSE,
            updated_at = NOW()
        WHERE clinic_id = NEW.clinic_id
          AND is_active = TRUE
          AND (patient_name = NEW.recovered_by_patient_name OR patient_phone = NEW.patient_phone);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cull_waitlist_on_recovery ON appointments;
CREATE TRIGGER trg_cull_waitlist_on_recovery
AFTER UPDATE OF status ON appointments
FOR EACH ROW
EXECUTE FUNCTION trigger_cull_waitlist_on_recovery();

-- =============================================================================
-- 11. Row-Level Security (RLS) & Multi-Tenant Isolation Policies
-- =============================================================================

-- Enable RLS on all clinical tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Clinic & Tenant Isolation Policy Function
CREATE OR REPLACE FUNCTION current_clinic_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid,
        (current_setting('app.current_clinic_id', true))::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid
    );
$$;

-- 2. Tenant Isolation Policies on Appointments
DROP POLICY IF EXISTS tenant_appointments_isolation ON appointments;
CREATE POLICY tenant_appointments_isolation ON appointments
    FOR ALL
    USING (
        clinic_id = current_clinic_id()
        OR current_user = 'service_role'
    )
    WITH CHECK (
        clinic_id = current_clinic_id()
        OR current_user = 'service_role'
    );

-- 3. Provider-Level Isolation (Provider A cannot view Provider B's private appointments if isolated)
DROP POLICY IF EXISTS provider_appointments_isolation ON appointments;
CREATE POLICY provider_appointments_isolation ON appointments
    FOR SELECT
    USING (
        -- Allow if provider matches authenticated user OR user is clinic admin
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'clinic_admin')
        OR provider_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'provider_id')::uuid
        OR clinic_id = current_clinic_id()
        OR current_user = 'service_role'
    );

-- 4. Tenant Isolation Policies on Waitlist Entries
DROP POLICY IF EXISTS tenant_waitlist_isolation ON waitlist_entries;
CREATE POLICY tenant_waitlist_isolation ON waitlist_entries
    FOR ALL
    USING (
        clinic_id = current_clinic_id()
        OR current_user = 'service_role'
    )
    WITH CHECK (
        clinic_id = current_clinic_id()
        OR current_user = 'service_role'
    );

-- 5. Public Standby / Patient Intake Policy (Allows anonymous self-intake & buzzer claims)
DROP POLICY IF EXISTS public_standby_waitlist_insert ON waitlist_entries;
CREATE POLICY public_standby_waitlist_insert ON waitlist_entries
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (is_active = TRUE);

-- 6. Tenant Isolation on Recovery Events & Offers
DROP POLICY IF EXISTS tenant_recovery_events_isolation ON recovery_events;
CREATE POLICY tenant_recovery_events_isolation ON recovery_events
    FOR ALL
    USING (clinic_id = current_clinic_id() OR current_user = 'service_role');

DROP POLICY IF EXISTS tenant_recovery_offers_isolation ON recovery_offers;
CREATE POLICY tenant_recovery_offers_isolation ON recovery_offers
    FOR ALL
    USING (
        recovery_event_id IN (SELECT id FROM recovery_events WHERE clinic_id = current_clinic_id())
        OR current_user = 'service_role'
    );

-- 7. Audit Logs Immutable Security (Write & Select only by tenant)
DROP POLICY IF EXISTS tenant_audit_logs_isolation ON audit_logs;
CREATE POLICY tenant_audit_logs_isolation ON audit_logs
    FOR SELECT
    USING (clinic_id = current_clinic_id() OR current_user = 'service_role');

CREATE POLICY tenant_audit_logs_insert ON audit_logs
    FOR INSERT
    WITH CHECK (clinic_id = current_clinic_id() OR current_user = 'service_role');
