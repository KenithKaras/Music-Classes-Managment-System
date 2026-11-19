-- ==============================================================================
-- Migration: 012_payment_links.sql
-- Description: Per-academy signed payment links schema and security policies.
--
-- CHANGES INCLUDED:
-- 1. Table: public.payment_links
--    - id (uuid, primary key, default gen_random_uuid()): Unique link record identifier.
--    - owner_id (uuid, not null, default auth.uid(), references auth.users(id) on delete cascade):
--      The academy owner who generated the signed link.
--    - fee_id (uuid, not null, references public.monthly_fees(id) on delete cascade):
--      The associated monthly fee record.
--    - amount_paise (integer, not null, check amount_paise > 0):
--      Exact balance due in paise (e.g., 150000 paise = ₹1,500.00).
--    - note (text, not null, check char_length(note) <= 80):
--      Transaction note strictly formatted as "Music fees <Mon YYYY>" (no student PII).
--    - upi_id (text, not null):
--      Academy's verified UPI VPA at the time of link creation.
--    - payee_name (text, not null, check char_length(payee_name) <= 60):
--      Payee name (max 60 characters).
--    - token_hash (text, not null, unique):
--      SHA-256 hexadecimal hash of the random 32-byte base64url token.
--    - status (text, not null, default 'active', check status in ('active', 'revoked')):
--      Status of the link.
--    - expires_at (timestamptz, not null):
--      Expiry timestamp (7 days from creation).
--    - created_at (timestamptz, not null, default now()):
--      Creation timestamp.
--
-- 2. Security & Row Level Security (RLS):
--    - RLS enabled on public.payment_links.
--    - Owner-only SELECT policy using owner_id = (select auth.uid()).
--    - Owner-only INSERT policy with check owner_id = (select auth.uid()).
--    - Owner-only UPDATE policy using and with check owner_id = (select auth.uid()).
--    - No DELETE policy (users cannot delete payment links).
--    - No anon policy (public resolution handled securely via service-role in resolve-payment-link).
--
-- 3. Performance Indexes:
--    - idx_payment_links_owner_id on (owner_id).
--    - idx_payment_links_fee_id on (fee_id).
--
-- SAFETY & COMPLIANCE:
-- - Uses IF NOT EXISTS everywhere; strictly re-runnable.
-- - Does not alter any existing tables or columns.
-- ==============================================================================

create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fee_id uuid not null references public.monthly_fees(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  note text not null check (char_length(note) <= 80),
  upi_id text not null,
  payee_name text not null check (char_length(payee_name) <= 60),
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Performance Indexes
create index if not exists idx_payment_links_owner_id on public.payment_links (owner_id);
create index if not exists idx_payment_links_fee_id on public.payment_links (fee_id);

-- Enable Row Level Security
alter table public.payment_links enable row level security;

-- Owner-only RLS Policies (wrapped in subquery (select auth.uid()) for performance)
drop policy if exists "payment_links_owner_select" on public.payment_links;
create policy "payment_links_owner_select"
  on public.payment_links for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "payment_links_owner_insert" on public.payment_links;
create policy "payment_links_owner_insert"
  on public.payment_links for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "payment_links_owner_update" on public.payment_links;
create policy "payment_links_owner_update"
  on public.payment_links for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
