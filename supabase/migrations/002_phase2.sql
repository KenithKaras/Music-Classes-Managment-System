-- Migration: 002_phase2.sql
-- Description: Phase 2 schema for "MIX with Me Classes"
-- Creates batches table, students table, indexes, check constraints, RLS policies, and student-photos storage bucket.

-- ==============================================================================
-- 1. BATCHES TABLE
-- ==============================================================================
-- Stores music class batches / schedules.
-- days_of_week stores values like ARRAY['Mon', 'Wed', 'Fri']
-- ==============================================================================

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  days_of_week text[] not null check (cardinality(days_of_week) > 0),
  start_time time not null,
  end_time time not null,
  capacity integer check (capacity is null or capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batches_end_time_check check (end_time > start_time)
);

-- Auto-update updated_at timestamp trigger for batches
drop trigger if exists update_batches_updated_at on public.batches;
create trigger update_batches_updated_at
  before update on public.batches
  for each row
  execute function public.update_updated_at_column();

-- Enable Row Level Security on batches
alter table public.batches enable row level security;

-- Admin check policy: Only authenticated users whose email exists in admin_users have full access
create policy "Allow authenticated admin full access to batches"
  on public.batches
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

-- ==============================================================================
-- 2. STUDENTS TABLE
-- ==============================================================================
-- Stores student records.
-- monthly_fee is copied from academy_settings.default_monthly_fee at creation time,
-- ensuring changes to default settings do NOT retroactively change existing students.
-- Deleting a batch sets batch_id to null (on delete set null).
-- ==============================================================================

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  photo_url text,
  guardian_name text,
  guardian_phone text,
  address text,
  enrollment_date date not null default current_date,
  batch_id uuid references public.batches(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  monthly_fee integer not null check (monthly_fee >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Performance Indexes (Supabase Postgres Best Practice)
create index if not exists students_batch_id_idx on public.students (batch_id);
create index if not exists students_status_idx on public.students (status);
create index if not exists students_created_at_idx on public.students (created_at desc);

-- Auto-update updated_at timestamp trigger for students
drop trigger if exists update_students_updated_at on public.students;
create trigger update_students_updated_at
  before update on public.students
  for each row
  execute function public.update_updated_at_column();

-- Enable Row Level Security on students
alter table public.students enable row level security;

-- Admin check policy: Only authenticated admin can read and write students
create policy "Allow authenticated admin full access to students"
  on public.students
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

-- ==============================================================================
-- 3. STORAGE BUCKET: student-photos
-- ==============================================================================
-- We chose a PUBLIC bucket with ADMIN-ONLY WRITE policies.
-- Why this approach:
-- 1. Performance & CDN: Profile pictures in teacher rosters, student profiles,
--    and attendance lists are displayed repeatedly. A public bucket allows
--    fast CDN asset caching directly without generating temporary signed URLs
--    or handling token expiration.
-- 2. Security: Uploading, replacing, and deleting photos are strictly restricted
--    to the authenticated admin via Row Level Security on storage.objects.
-- ==============================================================================

-- Create bucket if it doesn't already exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-photos',
  'student-photos',
  true,
  2097152, -- 2 MB limit in bytes
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS Policy 1: Anyone can view photos from the public bucket
drop policy if exists "Public read student-photos" on storage.objects;
create policy "Public read student-photos"
  on storage.objects
  for select
  using (bucket_id = 'student-photos');

-- Storage RLS Policy 2: Only authenticated admin can upload photos
drop policy if exists "Admin upload student-photos" on storage.objects;
create policy "Admin upload student-photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'student-photos'
    and exists (
      select 1 from public.admin_users
      where admin_users.email = (select auth.jwt() ->> 'email')
    )
  );

-- Storage RLS Policy 3: Only authenticated admin can update photos
drop policy if exists "Admin update student-photos" on storage.objects;
create policy "Admin update student-photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'student-photos'
    and exists (
      select 1 from public.admin_users
      where admin_users.email = (select auth.jwt() ->> 'email')
    )
  );

-- Storage RLS Policy 4: Only authenticated admin can delete photos
drop policy if exists "Admin delete student-photos" on storage.objects;
create policy "Admin delete student-photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'student-photos'
    and exists (
      select 1 from public.admin_users
      where admin_users.email = (select auth.jwt() ->> 'email')
    )
  );
