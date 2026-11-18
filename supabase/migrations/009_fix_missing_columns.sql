-- ==============================================================================
-- Migration: 009_fix_missing_columns.sql
-- Description: Fix missing columns causing HTTP 400 Bad Request on order=created_at.asc
-- Adds created_at to public.academy_settings and public.attendance,
-- plus updated_at to public.payments, ensuring standard timestamp auditing across all tables.
-- ==============================================================================

-- 1. ACADEMY SETTINGS: Add created_at column if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'academy_settings' 
      and column_name = 'created_at'
  ) then
    alter table public.academy_settings 
      add column created_at timestamptz not null default now();
  end if;
end $$;

create index if not exists academy_settings_created_at_idx 
  on public.academy_settings (created_at asc);

-- 2. ATTENDANCE: Add created_at column if not exists (sync with marked_at)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'attendance' 
      and column_name = 'created_at'
  ) then
    alter table public.attendance 
      add column created_at timestamptz not null default now();
    -- Initialize created_at from marked_at for existing records
    update public.attendance set created_at = marked_at where created_at is not null;
  end if;
end $$;

create index if not exists attendance_created_at_idx 
  on public.attendance (created_at asc);

-- 3. PAYMENTS: Add updated_at column if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'payments' 
      and column_name = 'updated_at'
  ) then
    alter table public.payments 
      add column updated_at timestamptz not null default now();
  end if;
end $$;

-- 4. Verification comment:
-- Tables now consistently support .order('created_at', { ascending: true })
-- without PostgREST throwing 42703 "column <table_name>.created_at does not exist".
