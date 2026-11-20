-- ==============================================================================
-- Migration: 013_payment_screenshots.sql
-- Description: Payment screenshot uploads for /pay page and academy owner review.
--
-- CHANGES INCLUDED:
-- 1. Table: public.payment_screenshots
--    - id (uuid, primary key, default gen_random_uuid()): Unique screenshot record identifier.
--    - owner_id (uuid, not null, references auth.users(id) on delete cascade):
--      The academy owner who owns the payment link.
--    - payment_link_id (uuid, not null, references public.payment_links(id) on delete cascade):
--      The signed payment link associated with this payment screenshot.
--    - storage_path (text, not null):
--      Path inside the private 'payment-screenshots' storage bucket.
--    - mime_type (text, not null, check in image/jpeg, image/png, image/webp).
--    - size_bytes (integer, not null, check size_bytes > 0 and <= 2097152 = 2MB).
--    - status (text, not null, default 'pending', check in 'pending', 'reviewed', 'deleted').
--    - reviewed_at (timestamptz, nullable): When the academy owner reviewed or recorded the payment.
--    - created_at (timestamptz, not null, default now()): Upload timestamp.
--
-- 2. Unique Constraint / Index:
--    - idx_payment_screenshots_link_id (unique on payment_link_id):
--      Enforces exactly one screenshot per payment link.
--
-- 3. Column addition:
--    - public.payment_links.screenshot_uploaded_at (timestamptz, nullable):
--      Tracks when a screenshot was uploaded for the link.
--
-- 4. Row Level Security (RLS) on public.payment_screenshots:
--    - RLS enabled.
--    - Owner-only SELECT policy using owner_id = (select auth.uid()).
--    - Owner-only UPDATE policy using and with check owner_id = (select auth.uid()).
--    - No INSERT policy for standard users (public uploads occur exclusively via upload-payment-screenshot Edge Function using service role).
--    - No anon policies.
--
-- 5. Performance Indexes:
--    - idx_payment_screenshots_owner_id on (owner_id).
--    - idx_payment_screenshots_status on (status).
--
-- 6. Retention Function:
--    - public.purge_payment_screenshots(): Helper function to soft-delete screenshots
--      older than 30 days post-review or 60 days post-upload (unscheduled).
--
-- SAFETY & COMPLIANCE:
-- - All operations use IF NOT EXISTS / OR REPLACE; strictly re-runnable.
-- - No existing table structures or rows are mutated destructively.
-- ==============================================================================

-- 1. Add screenshot_uploaded_at column to payment_links
alter table public.payment_links
  add column if not exists screenshot_uploaded_at timestamptz;

-- 2. Create payment_screenshots table
create table if not exists public.payment_screenshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  payment_link_id uuid not null references public.payment_links(id) on delete cascade,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 2097152),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'deleted')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 3. Unique index: one screenshot per payment link
create unique index if not exists idx_payment_screenshots_link_id
  on public.payment_screenshots (payment_link_id);

-- 4. Performance indexes
create index if not exists idx_payment_screenshots_owner_id
  on public.payment_screenshots (owner_id);

create index if not exists idx_payment_screenshots_status
  on public.payment_screenshots (status);

-- 5. Enable Row Level Security
alter table public.payment_screenshots enable row level security;

-- 6. Owner-only RLS policies
drop policy if exists "payment_screenshots_owner_select" on public.payment_screenshots;
create policy "payment_screenshots_owner_select"
  on public.payment_screenshots for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "payment_screenshots_owner_update" on public.payment_screenshots;
create policy "payment_screenshots_owner_update"
  on public.payment_screenshots for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "payment_screenshots_owner_delete" on public.payment_screenshots;
create policy "payment_screenshots_owner_delete"
  on public.payment_screenshots for delete to authenticated
  using (owner_id = (select auth.uid()));

-- 7. Retention Function (Unscheduled - execute manually or configure as pg_cron when desired)
create or replace function public.purge_payment_screenshots()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purged_count integer;
begin
  -- Marks records as deleted if reviewed > 30 days ago or created > 60 days ago
  update public.payment_screenshots
  set status = 'deleted'
  where status != 'deleted'
    and (
      (status = 'reviewed' and reviewed_at < now() - interval '30 days')
      or created_at < now() - interval '60 days'
    );
  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;
