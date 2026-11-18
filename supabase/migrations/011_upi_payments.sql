-- ==============================================================================
-- Migration: 011_upi_payments.sql
-- Description: Schema additions for UPI payment details and transaction tracking.
--
-- CHANGES INCLUDED:
-- 1. public.academy_settings:
--    - upi_id (text, nullable): Academy's UPI VPA (format: name@handle).
--    - upi_payee_name (text, nullable): Registered payee name for the UPI VPA (max 60 chars).
--    - upi_qr_path (text, nullable): Storage path in academy-assets bucket ({owner_id}/upi/qr.png).
--
-- 2. public.payments:
--    - upi_txn_id (text, nullable): 6-35 alphanumeric UPI Transaction ID / UTR.
--    - idx_payments_owner_upi_txn_id: Partial unique index enforcing no duplicate UTR
--      within the same academy owner (owner_id, upi_txn_id) WHERE upi_txn_id IS NOT NULL.
--
-- SAFETY & COMPLIANCE:
-- - All statements use IF NOT EXISTS / IF EXISTS checks so it is safely re-runnable.
-- - Existing multi-tenant Row Level Security (RLS) policies remain intact.
-- - No existing tables or columns dropped; zero existing data altered.
-- ==============================================================================

-- 1. ACADEMY SETTINGS: Add UPI configuration columns
do $$
begin
  -- 1.1 upi_id
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'academy_settings'
      and column_name = 'upi_id'
  ) then
    alter table public.academy_settings
      add column upi_id text;
  end if;

  -- 1.2 upi_payee_name
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'academy_settings'
      and column_name = 'upi_payee_name'
  ) then
    alter table public.academy_settings
      add column upi_payee_name text;
  end if;

  -- 1.3 upi_qr_path
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'academy_settings'
      and column_name = 'upi_qr_path'
  ) then
    alter table public.academy_settings
      add column upi_qr_path text;
  end if;
end $$;

-- 2. PAYMENTS: Add UPI Transaction ID (UTR) column
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'upi_txn_id'
  ) then
    alter table public.payments
      add column upi_txn_id text;
  end if;
end $$;

-- 3. INDEX: Partial unique index on (owner_id, upi_txn_id)
-- Prevents duplicate UTR recording within the same academy while allowing nulls
create unique index if not exists idx_payments_owner_upi_txn_id
  on public.payments (owner_id, upi_txn_id)
  where upi_txn_id is not null;
