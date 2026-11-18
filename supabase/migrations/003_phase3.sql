-- Migration: 003_phase3.sql
-- Description: Phase 3 schema for "MIX with Me Classes" - Classes & Timetable
-- Creates classes table, check constraints, overlap prevention trigger, RLS policies, and performance indexes.

-- ==============================================================================
-- 1. EXTENSION: btree_gist
-- ==============================================================================
-- btree_gist allows using standard scalar types (like date, uuid, text) with GiST indexes.
-- We enable it here so that exclusion constraints across scalar types and ranges can be used.
-- ==============================================================================
create extension if not exists btree_gist;

-- ==============================================================================
-- 2. CLASSES TABLE
-- ==============================================================================
-- Stores individual scheduled and cancelled class sessions.
-- Recurring schedules originate from batches (days_of_week, start_time, end_time).
-- Class rows are generated for dates when viewed or created on-demand for custom edits/cancellations.
-- ==============================================================================
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  class_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_end_time_check check (end_time > start_time)
);

-- Performance Indexes
create index if not exists classes_class_date_idx on public.classes (class_date);
create index if not exists classes_batch_id_idx on public.classes (batch_id);
create index if not exists classes_status_idx on public.classes (status);

-- Auto-update updated_at timestamp trigger for classes
drop trigger if exists update_classes_updated_at on public.classes;
create trigger update_classes_updated_at
  before update on public.classes
  for each row
  execute function public.update_updated_at_column();

-- ==============================================================================
-- 3. SCHEDULE OVERLAP PREVENTION (CROSS-BATCH CONFLICT CHECK)
-- ==============================================================================
-- Music teacher is a SINGLE teacher managing all batches.
-- Therefore, classes must NEVER overlap in time on the same date across ALL batches.
-- Cancelled classes (status = 'cancelled') are ignored from overlap calculations.
--
-- We implement this via a robust BEFORE INSERT OR UPDATE trigger using PostgreSQL's
-- built-in OVERLAPS operator. This checks (new.start_time, new.end_time) OVERLAPS
-- (c.start_time, c.end_time) and raises a clear, descriptive exception naming the
-- conflicting batch and timing.
--
-- Note on btree_gist exclusion constraints:
-- An exclusion constraint can also be written using btree_gist with tsrange(class_date + start_time, class_date + end_time).
-- The trigger approach below provides friendlier error messages directly mentioning the batch name.
-- ==============================================================================

create or replace function public.check_class_overlap()
returns trigger as $$
declare
  conflict_record record;
begin
  -- Cancelled classes do not occupy the teacher's time
  if new.status = 'cancelled' then
    return new;
  end if;

  -- Check if any other non-cancelled class on the same date overlaps in time
  select 
    c.id, 
    b.name as batch_name, 
    c.start_time, 
    c.end_time
  into conflict_record
  from public.classes c
  join public.batches b on b.id = c.batch_id
  where c.class_date = new.class_date
    and c.status != 'cancelled'
    and c.id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and (new.start_time, new.end_time) overlaps (c.start_time, c.end_time)
  limit 1;

  if found then
    raise exception 'Schedule conflict: Overlaps with batch "%" on % (% - %)',
      conflict_record.batch_name, 
      new.class_date, 
      to_char(conflict_record.start_time, 'HH12:MI AM'), 
      to_char(conflict_record.end_time, 'HH12:MI AM')
      using errcode = '23P01'; -- exclusion_violation
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists check_class_overlap_trigger on public.classes;
create trigger check_class_overlap_trigger
  before insert or update on public.classes
  for each row
  execute function public.check_class_overlap();

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ==============================================================================
alter table public.classes enable row level security;

-- Only authenticated admin can read and write classes
create policy "Allow authenticated admin full access to classes"
  on public.classes
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
