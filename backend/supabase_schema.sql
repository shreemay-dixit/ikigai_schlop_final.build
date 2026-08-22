-- =============================================================================
-- Supabase Schema DDL: Queue Intelligence Platform
-- =============================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Create Table: tenants
create table if not exists public.tenants (
    id uuid primary key default gen_random_uuid(),
    business_id text unique not null,
    industry text not null,
    ai_persona text not null,
    active_counters integer not null default 1,
    base_service_time_mins float not null default 12.0,
    created_at timestamptz not null default now()
);

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

-- 5. Seed Demo Tenants
insert into public.tenants (business_id, industry, ai_persona, active_counters, base_service_time_mins)
values 
    (
        'metro_urgent_care', 
        'Healthcare', 
        'hospital emergency intake and triage desk. Urgent medical emergencies, acute chest pain, or severe bleeding must receive priority 5.', 
        3, 
        15.0
    ),
    (
        'apex_bank_downtown', 
        'Banking & Financial Services', 
        'commercial retail bank customer service branch. Large mortgage queries, business loans, or high-value wealth disputes are complex service tier 2.', 
        4, 
        10.0
    ),
    (
        'central_dmv_office', 
        'Government & Licensing', 
        'department of motor vehicles licensing and vehicle registration center. Routine renewals are service tier 0, commercial driver permits are service tier 2.', 
        5, 
        8.0
    )
on conflict (business_id) do nothing;
