-- ==============================================================================
-- Migration: 014_enrollment.sql
-- Description: Student enrollment links and parent registration submissions.
--
-- CHANGES INCLUDED:
-- 1. Table: public.enrollment_links
--    - id (uuid, primary key, default gen_random_uuid()): Unique link identifier.
--    - owner_id (uuid, not null, references auth.users(id) on delete cascade):
--      The academy owner who created the link.
--    - token_hash (text, not null, unique):
--      SHA-256 hexadecimal hash of the random 32-byte base64url token.
--    - status (text, not null, default 'active', check in 'active', 'revoked').
--    - expires_at (timestamptz, not null): Expiry timestamp (e.g., 7 days).
--    - max_submissions (integer, not null, default 5, check between 1 and 20).
--    - submissions_count (integer, not null, default 0).
--    - created_at (timestamptz, not null, default now()).
--
-- 2. Table: public.enrollment_submissions
--    - id (uuid, primary key, default gen_random_uuid()): Submission record identifier.
--    - owner_id (uuid, not null, references auth.users(id) on delete cascade):
--      The academy owner who will review the submission.
--    - enrollment_link_id (uuid, not null, references public.enrollment_links(id) on delete cascade):
--      The link used to register.
--    - child_name (text, not null, check char_length between 2 and 80).
--    - parent_name (text, not null, check char_length between 2 and 80).
--    - parent_phone (text, not null, check ~ '^[0-9]{10}$').
--    - parent_email (text, nullable, check char_length <= 120).
--    - address (text, nullable, check char_length <= 300).
--    - preferred_batch (text, nullable, check char_length <= 60).
--    - photo_path (text, nullable): Path in 'enrollment-photos' bucket.
--    - consent_at (timestamptz, not null): Explicit timestamp of parent consent.
--    - status (text, not null, default 'pending', check in 'pending', 'approved', 'rejected').
--    - student_id (uuid, nullable, references public.students(id) on delete set null):
--      Populated when owner approves submission and creates/links student record.
--    - reviewed_at (timestamptz, nullable): Timestamp when reviewed by academy owner.
--    - created_at (timestamptz, not null, default now()).
--    - NOTE: NO date of birth field included (strictly prohibited).
--
-- 3. Row Level Security (RLS) on both tables:
--    - RLS enabled on both public.enrollment_links and public.enrollment_submissions.
--    - Owner-only SELECT policy using owner_id = (select auth.uid()).
--    - Owner-only UPDATE policy using and with check owner_id = (select auth.uid()).
--    - No INSERT policy for regular authenticated users (inserts happen strictly
--      via create-enrollment-link and submit-enrollment Edge Functions using the service role).
--    - No anon policies.
--
-- 4. Performance Indexes:
--    - idx_enrollment_links_owner_id on (owner_id).
--    - idx_enrollment_submissions_owner_id on (owner_id).
--    - idx_enrollment_submissions_link_id on (enrollment_link_id).
--    - idx_enrollment_submissions_status on (status).
--
-- 5. Retention Function:
--    - public.purge_enrollment_data(): Helper function to soft-delete or remove rejected
--      submissions older than 90 days and pending submissions older than 180 days (unscheduled).
--
-- SAFETY & COMPLIANCE:
-- - All operations use IF NOT EXISTS / OR REPLACE; strictly re-runnable.
-- - No existing table structures or rows are mutated destructively.
-- ==============================================================================

-- 1. Table: enrollment_links
create table if not exists public.enrollment_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz not null,
  max_submissions integer not null default 5 check (max_submissions between 1 and 20),
  submissions_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Indexes for enrollment_links
create index if not exists idx_enrollment_links_owner_id
  on public.enrollment_links (owner_id);

-- Enable RLS for enrollment_links
alter table public.enrollment_links enable row level security;

-- Owner-only RLS policies for enrollment_links
drop policy if exists "enrollment_links_owner_select" on public.enrollment_links;
create policy "enrollment_links_owner_select"
  on public.enrollment_links for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "enrollment_links_owner_update" on public.enrollment_links;
create policy "enrollment_links_owner_update"
  on public.enrollment_links for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "enrollment_links_owner_delete" on public.enrollment_links;
create policy "enrollment_links_owner_delete"
  on public.enrollment_links for delete to authenticated
  using (owner_id = (select auth.uid()));


-- 2. Table: enrollment_submissions
create table if not exists public.enrollment_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  enrollment_link_id uuid not null references public.enrollment_links(id) on delete cascade,
  child_name text not null check (char_length(child_name) between 2 and 80),
  parent_name text not null check (char_length(parent_name) between 2 and 80),
  parent_phone text not null check (parent_phone ~ '^[0-9]{10}$'),
  parent_email text check (parent_email is null or char_length(parent_email) <= 120),
  address text check (address is null or char_length(address) <= 300),
  preferred_batch text check (preferred_batch is null or char_length(preferred_batch) <= 60),
  photo_path text,
  consent_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  student_id uuid references public.students(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes for enrollment_submissions
create index if not exists idx_enrollment_submissions_owner_id
  on public.enrollment_submissions (owner_id);

create index if not exists idx_enrollment_submissions_link_id
  on public.enrollment_submissions (enrollment_link_id);

create index if not exists idx_enrollment_submissions_status
  on public.enrollment_submissions (status);

-- Enable RLS for enrollment_submissions
alter table public.enrollment_submissions enable row level security;

-- Owner-only RLS policies for enrollment_submissions
drop policy if exists "enrollment_submissions_owner_select" on public.enrollment_submissions;
create policy "enrollment_submissions_owner_select"
  on public.enrollment_submissions for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "enrollment_submissions_owner_update" on public.enrollment_submissions;
create policy "enrollment_submissions_owner_update"
  on public.enrollment_submissions for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "enrollment_submissions_owner_delete" on public.enrollment_submissions;
create policy "enrollment_submissions_owner_delete"
  on public.enrollment_submissions for delete to authenticated
  using (owner_id = (select auth.uid()));


-- 3. Retention Function (Unscheduled - execute manually or configure as pg_cron when desired)
create or replace function public.purge_enrollment_data()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purged_count integer;
begin
  -- Deletes rejected submissions older than 90 days and pending submissions older than 180 days
  delete from public.enrollment_submissions
  where (status = 'rejected' and reviewed_at < now() - interval '90 days')
     or (status = 'pending' and created_at < now() - interval '180 days');
  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;
