-- Migration: 004_phase3_attendance.sql
-- Description: Phase 3 schema for "MIX with Me Classes" - Attendance System
-- Creates attendance table, constraints, batch verification trigger, RLS policies, and indexes.

-- ==============================================================================
-- 1. ATTENDANCE TABLE
-- ==============================================================================
-- Records presence or absence of students per class session.
-- Unique constraint on (class_id, student_id) guarantees no duplicate records.
-- ==============================================================================
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  marked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_class_student_unique unique (class_id, student_id)
);

-- Performance Indexes
create index if not exists attendance_class_id_idx on public.attendance (class_id);
create index if not exists attendance_student_id_idx on public.attendance (student_id);
create index if not exists attendance_status_idx on public.attendance (status);

-- Auto-update updated_at timestamp trigger for attendance
drop trigger if exists update_attendance_updated_at on public.attendance;
create trigger update_attendance_updated_at
  before update on public.attendance
  for each row
  execute function public.update_updated_at_column();

-- ==============================================================================
-- 2. VALIDATION TRIGGER
-- ==============================================================================
-- Enforces:
-- 1. Attendance CANNOT be marked for cancelled classes.
-- 2. A student must belong to the same batch as the class (or historical record check).
-- ==============================================================================
create or replace function public.validate_attendance_record()
returns trigger as $$
declare
  v_class_batch_id uuid;
  v_class_status text;
  v_student_batch_id uuid;
  v_student_name text;
begin
  -- Fetch class details
  select batch_id, status
  into v_class_batch_id, v_class_status
  from public.classes
  where id = new.class_id;

  if not found then
    raise exception 'Invalid class: Class record does not exist';
  end if;

  -- 1. Cannot mark attendance for cancelled class
  if v_class_status = 'cancelled' then
    raise exception 'Cannot mark attendance for a cancelled class';
  end if;

  -- Fetch student details
  select full_name, batch_id
  into v_student_name, v_student_batch_id
  from public.students
  where id = new.student_id;

  if not found then
    raise exception 'Invalid student: Student record does not exist';
  end if;

  -- 2. Verify student's batch matches class batch
  if v_student_batch_id is distinct from v_class_batch_id then
    raise exception 'Student "%" does not belong to the batch for this class', v_student_name;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists validate_attendance_record_trigger on public.attendance;
create trigger validate_attendance_record_trigger
  before insert or update on public.attendance
  for each row
  execute function public.validate_attendance_record();

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ==============================================================================
alter table public.attendance enable row level security;

-- Only authenticated admin can read and write attendance records
create policy "Allow authenticated admin full access to attendance"
  on public.attendance
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
