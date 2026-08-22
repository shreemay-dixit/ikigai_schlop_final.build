-- =============================================================================
-- Migration: Initial Schema for Queue Management Backend
-- Milestone 2: Core Tables (businesses, business_config, queue_entries)
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Table: businesses
-- Represents organizational units or store locations operating queues.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. Table: business_config
-- Stores operational defaults and runtime settings per business.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
    average_service_time NUMERIC NOT NULL DEFAULT 15,
    active_counters INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Validation Constraints
    CONSTRAINT chk_business_config_avg_service_time CHECK (average_service_time > 0),
    CONSTRAINT chk_business_config_active_counters CHECK (active_counters >= 1)
);

-- -----------------------------------------------------------------------------
-- 3. Table: queue_entries
-- Primary source of truth for queue tokens, ML features, and lifecycle states.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS queue_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    user_name TEXT,
    
    -- Exact ML Input Features & Attributes
    service_type INTEGER NOT NULL,
    priority_score INTEGER NOT NULL,
    is_walk_in BOOLEAN NOT NULL,
    party_size INTEGER NOT NULL,
    age_bracket INTEGER NOT NULL,
    queue_length_ahead INTEGER NOT NULL,
    active_counters INTEGER NOT NULL,
    rolling_velocity_mins NUMERIC NOT NULL,
    predicted_wait_mins NUMERIC NOT NULL,
    
    -- Lifecycle State
    status TEXT NOT NULL DEFAULT 'waiting',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Validation Constraints (Matching ML Model & Domain Rules)
    CONSTRAINT chk_queue_entries_service_type CHECK (service_type >= 0 AND service_type <= 2),
    CONSTRAINT chk_queue_entries_priority_score CHECK (priority_score >= 1 AND priority_score <= 5),
    CONSTRAINT chk_queue_entries_party_size CHECK (party_size >= 1),
    CONSTRAINT chk_queue_entries_age_bracket CHECK (age_bracket >= 0 AND age_bracket <= 2),
    CONSTRAINT chk_queue_entries_queue_length_ahead CHECK (queue_length_ahead >= 0),
    CONSTRAINT chk_queue_entries_active_counters CHECK (active_counters >= 1),
    CONSTRAINT chk_queue_entries_rolling_velocity CHECK (rolling_velocity_mins > 0),
    CONSTRAINT chk_queue_entries_predicted_wait CHECK (predicted_wait_mins >= 0),
    CONSTRAINT chk_queue_entries_status CHECK (status IN ('waiting', 'serving', 'completed', 'cancelled'))
);

-- -----------------------------------------------------------------------------
-- 4. Optimized Indexes
-- -----------------------------------------------------------------------------

-- Index 1: Optimized for active queue retrieval and queue depth lookups
-- Query pattern: WHERE business_id = $1 AND status = 'waiting' ORDER BY created_at ASC
CREATE INDEX IF NOT EXISTS idx_queue_entries_waiting 
    ON queue_entries (business_id, created_at ASC) 
    WHERE status = 'waiting';

-- Index 2: Optimized for recent completed entries for rolling-average velocity calculations
-- Query pattern: WHERE business_id = $1 AND status = 'completed' ORDER BY completed_at DESC
CREATE INDEX IF NOT EXISTS idx_queue_entries_completed 
    ON queue_entries (business_id, completed_at DESC) 
    WHERE status = 'completed';

-- Index 3: General lookup by business and status
CREATE INDEX IF NOT EXISTS idx_queue_entries_business_status 
    ON queue_entries (business_id, status);

-- -----------------------------------------------------------------------------
-- 5. Realtime Configuration
-- Enable full row replication for Supabase Realtime broadcast and change listening.
-- -----------------------------------------------------------------------------
ALTER TABLE queue_entries REPLICA IDENTITY FULL;

-- Add queue_entries to supabase_realtime publication if the publication exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE queue_entries;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. Token Generation Sequence & Helpers
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS queue_token_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION get_next_queue_token(p_prefix TEXT DEFAULT 'A')
RETURNS TEXT AS $$
DECLARE
    next_num BIGINT;
BEGIN
    next_num := nextval('queue_token_seq');
    RETURN p_prefix || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 7. Row Level Security & Development Permissions
-- -----------------------------------------------------------------------------
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all access on businesses" ON businesses;
CREATE POLICY "Allow public all access on businesses" ON businesses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access on business_config" ON business_config;
CREATE POLICY "Allow public all access on business_config" ON business_config FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access on queue_entries" ON queue_entries;
CREATE POLICY "Allow public all access on queue_entries" ON queue_entries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
