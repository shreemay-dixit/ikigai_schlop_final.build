-- =============================================================================
-- Supabase Schema DDL: Plug & Play Multi-Tenant Queue Intelligence Platform
-- =============================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Create Table: tenants (Agnostic Multi-Tenant Configuration)
create table if not exists public.tenants (
    id uuid primary key default gen_random_uuid(),
    business_id text unique not null,
    business_name text not null default 'Service Center',
    industry text not null,
    ai_persona text not null,
    urgency_guidelines text not null default '',
    active_counters integer not null default 1,
    base_service_time_mins float not null default 12.0,
    created_at timestamptz not null default now()
);

-- Ensure newly added columns exist if table was already created
alter table public.tenants add column if not exists business_name text not null default 'Service Center';
alter table public.tenants add column if not exists urgency_guidelines text not null default '';

-- 2. Create Table: queue_entries
create table if not exists public.queue_entries (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    business_id text not null,
    ticket_number text not null,
    phone_number text,
    priority_score integer not null default 1,
    predicted_wait_mins float not null default 2.0,
    display_range text not null,
    status text not null default 'waiting' check (status in ('waiting', 'in_progress', 'completed', 'cancelled', 'no_show')),
    served_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null default now()
);

-- 3. Indexes for fast queue lookups & sliding-window metrics
create index if not exists idx_queue_entries_tenant_status 
on public.queue_entries (tenant_id, status);

create index if not exists idx_queue_entries_business_status 
on public.queue_entries (business_id, status);

create index if not exists idx_queue_entries_completed 
on public.queue_entries (business_id, status, completed_at desc);

-- 4. Enable Supabase Realtime for live queue changes
alter publication supabase_realtime add table public.queue_entries;
alter publication supabase_realtime add table public.tenants;

-- 5. Seed 4 Distinct Industry Tenants
insert into public.tenants (business_id, business_name, industry, ai_persona, urgency_guidelines, active_counters, base_service_time_mins)
values 
    (
        'metro_urgent_care',
        'Metro Urgent Care Clinic',
        'Healthcare',
        'Hospital Emergency Triage and Walk-in Clinic Intake Desk.',
        'Priority 5 = Severe life-threatening emergency, acute chest pain, anaphylaxis, severe breathing difficulty, profuse bleeding. Priority 4 = High fever with distress, acute fractures. Priority 3 = Moderate pain, cuts needing stitches. Priority 2 = Persistent cold/cough. Priority 1 = Routine checkup or prescription refill.',
        3, 
        15.0
    ),
    (
        'apex_commercial_bank',
        'Apex Commercial Bank',
        'Banking',
        'Commercial and Retail Banking Branch Reception & Wealth Advisory Desk.',
        'Priority 5 = Wire fraud, compromised business accounts, critical identity theft. Priority 4 = High Net Worth VIP commercial lending & time-sensitive escrow closing. Priority 3 = Loan consultation, new commercial business account. Priority 2 = Standard checking/savings advisory. Priority 1 = Routine cash/check deposit or ATM balance inquiry.',
        4, 
        10.0
    ),
    (
        'golden_bistro',
        'Golden Bistro & Lounge',
        'Hospitality / Restaurant',
        'Fine Dining & Bistro Hostess Table Seating Desk.',
        'Priority 5 = VIP guests, pre-paid large banquets, event host arrivals. Priority 4 = Celebrations (anniversary, birthdays) & confirmed advance reservations. Priority 3 = Standard walk-in table of 4-6. Priority 2 = Standard walk-in party of 2. Priority 1 = Bar seating, single walk-in, takeout pickup.',
        6, 
        25.0
    ),
    (
        'city_dmv',
        'City Department of Motor Vehicles',
        'Government Services',
        'Municipal Motor Vehicle & Public Licensing Service Center.',
        'Priority 5 = ADA accessibility assistance, medical transport driver triage. Priority 4 = Commercial driver license (CDL) urgent renewals, court-ordered reinstatements. Priority 3 = Driving skill tests, vehicle title disputes. Priority 2 = Standard driver license renewals. Priority 1 = Routine plate pickup, document drop-off, address update.',
        5, 
        8.0
    )
on conflict (business_id) do update set
    business_name = excluded.business_name,
    industry = excluded.industry,
    ai_persona = excluded.ai_persona,
    urgency_guidelines = excluded.urgency_guidelines,
    active_counters = excluded.active_counters,
    base_service_time_mins = excluded.base_service_time_mins;
