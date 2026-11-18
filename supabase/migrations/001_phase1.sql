-- Migration: 001_phase1.sql
-- Description: Phase 1 database schema for "MIX with Me Classes"
-- Creates academy_settings table, admin_users config table, and RLS policies.

-- ==============================================================================
-- 1. ADMIN CONFIG TABLE
-- ==============================================================================
-- We chose the "config table" approach for admin authorization.
-- Why this approach:
-- 1. Setting up an admin by email is much simpler and less error-prone than copying
--    a long Supabase Auth UUID (auth.uid()) into database policies.
-- 2. When creating your admin user in Supabase Dashboard (Authentication -> Users),
--    simply insert that same email into `admin_users`.
-- 3. The RLS policies verify that the logged-in user's email from the Supabase JWT
--    ((select auth.jwt() ->> 'email')) exists in this table.
-- ==============================================================================

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz not null default now()
);

-- Index for fast RLS lookups (Supabase Performance Best Practice)
create index if not exists admin_users_email_idx on public.admin_users (email);

-- Enable Row Level Security on admin_users
alter table public.admin_users enable row level security;

-- Allow authenticated users to view their own admin status
create policy "Allow authenticated users to read matching admin_users"
  on public.admin_users
  for select
  to authenticated
  using (
    email = (select auth.jwt() ->> 'email')
  );

-- ==============================================================================
-- 2. ACADEMY SETTINGS TABLE
-- ==============================================================================
-- Stores global academy configuration for the single-admin music academy.
-- ==============================================================================

create table if not exists public.academy_settings (
  id uuid primary key default gen_random_uuid(),
  academy_name text not null default 'MIX with Me Classes',
  logo_url text,
  contact_number text,
  email text,
  address text,
  default_monthly_fee integer not null default 1500, -- Amount in Indian Rupees (INR)
  payment_due_day integer not null default 5 check (payment_due_day >= 1 and payment_due_day <= 28),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security on academy_settings
alter table public.academy_settings enable row level security;

-- Admin check policy: Only authenticated users whose email is registered in admin_users
-- have full read and write access (SELECT, INSERT, UPDATE, DELETE).
create policy "Allow authenticated admin full access to academy_settings"
  on public.academy_settings
  for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_users
      where admin_users.email = (select auth.jwt() ->> 'email')
    )
  )
  with check (
    exists (
      select 1 from public.admin_users
      where admin_users.email = (select auth.jwt() ->> 'email')
    )
  );

-- Auto-update updated_at timestamp trigger
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_academy_settings_updated_at on public.academy_settings;
create trigger update_academy_settings_updated_at
  before update on public.academy_settings
  for each row
  execute function public.update_updated_at_column();

-- ==============================================================================
-- 3. SEED INITIAL DATA
-- ==============================================================================

-- Seed default admin email placeholder (Update this email to your Supabase Auth admin email)
insert into public.admin_users (email)
values ('admin@mixwithme.com')
on conflict (email) do nothing;

-- Seed one default row for academy settings
insert into public.academy_settings (
  academy_name,
  logo_url,
  contact_number,
  email,
  address,
  default_monthly_fee,
  payment_due_day
) values (
  'MIX with Me Classes',
  null,
  '+91 98765 43210',
  'contact@mixwithme.com',
  'Music Studio, MIX with Me Academy',
  1500,
  5
) on conflict do nothing;
