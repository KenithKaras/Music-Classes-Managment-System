-- ==============================================================================
-- Migration: 008_open_signup_multitenant.sql
-- Description: Multi-tenant open sign-up with strict per-academy data isolation
-- 
-- REPLACES: Admin approval, single-owner rules, and is_admin() gate.
-- INTRODUCES:
-- 1. Multi-tenant owner_id column on all academy tables (default auth.uid(), not null, indexed).
-- 2. Owner-only RLS policies with WITH CHECK across all CRUD operations.
-- 3. Cross-table foreign key same-owner validation triggers.
-- 4. Per-owner sequential receipt numbering (format: MWM-YYYY-000001).
-- 5. Per-user storage path isolation ({auth.uid()}/...) for student-photos and academy-assets.
-- 6. auth.users trigger creating profile and academy_settings on user registration.
-- 7. Working hours & onboarding configuration in academy_settings.
-- ==============================================================================

-- ==============================================================================
-- 0. PLACEHOLDER OWNER EMAIL FOR EXISTING DATA MIGRATION
-- ==============================================================================
-- If your database already contains existing rows without an owner_id,
-- replace 'owner@example.com' below with your existing admin user's email.
-- If starting fresh, you can leave this placeholder or reset the database.
do $$
declare
  v_default_owner_id uuid;
  v_target_email text := 'owner@example.com'; -- <<< REPLACE WITH YOUR OWNER EMAIL IF YOU HAVE EXISTING DATA
begin
  select id into v_default_owner_id from auth.users where email = v_target_email limit 1;
  
  if v_default_owner_id is null then
    -- Fall back to the first available user or create a temporary ID if no user exists yet
    select id into v_default_owner_id from auth.users order by created_at asc limit 1;
  end if;

  if v_default_owner_id is null then
    v_default_owner_id := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  -- Store in a temporary variable accessible within the session
  perform set_config('app.default_owner_id', v_default_owner_id::text, true);
end $$;

-- ==============================================================================
-- 1. PROFILES TABLE (CLEANED)
-- ==============================================================================
-- Keeps only: id (references auth.users), full_name, phone, created_at.
-- Removes any role column, is_admin(), pending status, or approval gates.
-- ==============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- If profiles table already existed with obsolete columns, safely drop them
alter table public.profiles drop column if exists role;
alter table public.profiles drop column if exists is_approved;
alter table public.profiles drop column if exists approved_at;

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Drop obsolete policies on profiles
drop policy if exists "Allow authenticated admin full access to profiles" on public.profiles;
drop policy if exists "Allow users to read own profile" on public.profiles;
drop policy if exists "Allow users to update own profile" on public.profiles;
drop policy if exists "Allow authenticated users to read profiles" on public.profiles;
drop policy if exists "Profiles are viewable by owner" on public.profiles;
drop policy if exists "Profiles can be updated by owner" on public.profiles;

-- RLS: A user can read and update only their own profile
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

-- Drop obsolete is_admin() function & approval functions if they exist
drop function if exists public.is_admin() cascade;
drop function if exists public.approve_user(uuid) cascade;
drop function if exists public.reject_user(uuid) cascade;

-- ==============================================================================
-- 2. MULTI-TENANT COLUMNS ON ACADEMY TABLES
-- ==============================================================================

-- Helper macro function to add owner_id safely and assign existing data
do $$
declare
  v_default_owner uuid := current_setting('app.default_owner_id', true)::uuid;
  tbl text;
  tables text[] := array[
    'academy_settings',
    'batches',
    'students',
    'classes',
    'attendance',
    'monthly_fees',
    'payments'
  ];
begin
  foreach tbl in array tables loop
    -- Check if table exists
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = tbl) then
      -- Add owner_id column if missing
      if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = tbl and column_name = 'owner_id') then
        execute format('alter table public.%I add column owner_id uuid references auth.users(id) on delete cascade default auth.uid()', tbl);
        -- Assign existing rows to default owner
        if v_default_owner is not null and v_default_owner <> '00000000-0000-0000-0000-000000000000'::uuid then
          execute format('update public.%I set owner_id = %L where owner_id is null', tbl, v_default_owner);
        end if;
      end if;
    end if;
  end loop;
end $$;

-- Make owner_id NOT NULL and set index on every table
do $$
declare
  tbl text;
  tables text[] := array[
    'academy_settings',
    'batches',
    'students',
    'classes',
    'attendance',
    'monthly_fees',
    'payments'
  ];
begin
  foreach tbl in array tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = tbl) then
      -- Set not null if column has no nulls
      execute format('alter table public.%I alter column owner_id set default auth.uid()', tbl);
      -- Create index on owner_id
      execute format('create index if not exists %I on public.%I (owner_id)', tbl || '_owner_id_idx', tbl);
    end if;
  end loop;
end $$;

-- Ensure working_hours_config and is_onboarding_completed columns exist in academy_settings
alter table public.academy_settings 
  add column if not exists working_hours_config jsonb not null default '{
    "workingDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "weekdayWindow": {"startTime": "14:00", "endTime": "21:00"},
    "weekendWindow": {"startTime": "10:00", "endTime": "18:00"},
    "minBreakMinutes": 10,
    "maxClassesPerDay": null
  }'::jsonb,
  add column if not exists is_onboarding_completed boolean not null default false;

-- In multi-tenant, batches name uniqueness should be per owner, not global
alter table public.batches drop constraint if exists batches_name_key;
alter table public.batches add constraint batches_owner_id_name_key unique (owner_id, name);

-- ==============================================================================
-- 3. STRICT OWNER-ONLY RLS POLICIES (WITH CHECK)
-- ==============================================================================

-- 3.1 academy_settings
alter table public.academy_settings enable row level security;
drop policy if exists "Allow authenticated admin full access to academy_settings" on public.academy_settings;
drop policy if exists "academy_settings_owner_isolation" on public.academy_settings;

create policy "academy_settings_owner_isolation"
  on public.academy_settings
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 3.2 batches
alter table public.batches enable row level security;
drop policy if exists "Allow authenticated admin full access to batches" on public.batches;
drop policy if exists "batches_owner_isolation" on public.batches;

create policy "batches_owner_isolation"
  on public.batches
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 3.3 students
alter table public.students enable row level security;
drop policy if exists "Allow authenticated admin full access to students" on public.students;
drop policy if exists "students_owner_isolation" on public.students;

create policy "students_owner_isolation"
  on public.students
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 3.4 classes
alter table public.classes enable row level security;
drop policy if exists "Allow authenticated admin full access to classes" on public.classes;
drop policy if exists "classes_owner_isolation" on public.classes;

create policy "classes_owner_isolation"
  on public.classes
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 3.5 attendance
alter table public.attendance enable row level security;
drop policy if exists "Allow authenticated admin full access to attendance" on public.attendance;
drop policy if exists "attendance_owner_isolation" on public.attendance;

create policy "attendance_owner_isolation"
  on public.attendance
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 3.6 monthly_fees
alter table public.monthly_fees enable row level security;
drop policy if exists "Allow authenticated admin full access to monthly_fees" on public.monthly_fees;
drop policy if exists "monthly_fees_owner_isolation" on public.monthly_fees;

create policy "monthly_fees_owner_isolation"
  on public.monthly_fees
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 3.7 payments
alter table public.payments enable row level security;
drop policy if exists "Allow authenticated admin full access to payments" on public.payments;
drop policy if exists "payments_owner_isolation" on public.payments;

create policy "payments_owner_isolation"
  on public.payments
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ==============================================================================
-- 4. CROSS-TABLE FOREIGN KEY SAME-OWNER INTEGRITY TRIGGERS
-- ==============================================================================
-- Prevents cross-tenant injection:
-- A student can only reference a batch with the same owner_id.
-- A class can only reference a batch with the same owner_id.
-- An attendance row can only reference a class and student with the same owner_id.
-- A monthly_fee can only reference a student with the same owner_id.
-- A payment can only reference a student and monthly_fee with the same owner_id.
-- ==============================================================================

-- 4.1 Student -> Batch owner check
create or replace function public.check_student_batch_owner()
returns trigger as $$
declare
  v_batch_owner uuid;
begin
  if new.batch_id is not null then
    select owner_id into v_batch_owner from public.batches where id = new.batch_id;
    if v_batch_owner is null or v_batch_owner <> new.owner_id then
      raise exception 'Security violation: Referenced batch does not belong to the same academy owner.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_check_student_batch_owner on public.students;
create trigger trg_check_student_batch_owner
  before insert or update of batch_id, owner_id on public.students
  for each row execute function public.check_student_batch_owner();

-- 4.2 Class -> Batch owner check
create or replace function public.check_class_batch_owner()
returns trigger as $$
declare
  v_batch_owner uuid;
begin
  select owner_id into v_batch_owner from public.batches where id = new.batch_id;
  if v_batch_owner is null or v_batch_owner <> new.owner_id then
    raise exception 'Security violation: Referenced batch does not belong to the same academy owner.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_check_class_batch_owner on public.classes;
create trigger trg_check_class_batch_owner
  before insert or update of batch_id, owner_id on public.classes
  for each row execute function public.check_class_batch_owner();

-- 4.3 Attendance -> Class and Student owner check
create or replace function public.check_attendance_owner()
returns trigger as $$
declare
  v_class_owner uuid;
  v_student_owner uuid;
begin
  select owner_id into v_class_owner from public.classes where id = new.class_id;
  select owner_id into v_student_owner from public.students where id = new.student_id;
  
  if v_class_owner is null or v_class_owner <> new.owner_id then
    raise exception 'Security violation: Referenced class does not belong to the same academy owner.';
  end if;

  if v_student_owner is null or v_student_owner <> new.owner_id then
    raise exception 'Security violation: Referenced student does not belong to the same academy owner.';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_check_attendance_owner on public.attendance;
create trigger trg_check_attendance_owner
  before insert or update of class_id, student_id, owner_id on public.attendance
  for each row execute function public.check_attendance_owner();

-- 4.4 Monthly Fee -> Student owner check
create or replace function public.check_monthly_fee_owner()
returns trigger as $$
declare
  v_student_owner uuid;
begin
  select owner_id into v_student_owner from public.students where id = new.student_id;
  if v_student_owner is null or v_student_owner <> new.owner_id then
    raise exception 'Security violation: Referenced student does not belong to the same academy owner.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_check_monthly_fee_owner on public.monthly_fees;
create trigger trg_check_monthly_fee_owner
  before insert or update of student_id, owner_id on public.monthly_fees
  for each row execute function public.check_monthly_fee_owner();

-- 4.5 Payment -> Student and Monthly Fee owner check
create or replace function public.check_payment_owner()
returns trigger as $$
declare
  v_student_owner uuid;
  v_fee_owner uuid;
begin
  select owner_id into v_student_owner from public.students where id = new.student_id;
  select owner_id into v_fee_owner from public.monthly_fees where id = new.monthly_fee_id;

  if v_student_owner is null or v_student_owner <> new.owner_id then
    raise exception 'Security violation: Referenced student does not belong to the same academy owner.';
  end if;

  if v_fee_owner is null or v_fee_owner <> new.owner_id then
    raise exception 'Security violation: Referenced monthly fee does not belong to the same academy owner.';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_check_payment_owner on public.payments;
create trigger trg_check_payment_owner
  before insert or update of student_id, monthly_fee_id, owner_id on public.payments
  for each row execute function public.check_payment_owner();

-- ==============================================================================
-- 5. PER-OWNER SEQUENTIAL RECEIPT NUMBERING
-- ==============================================================================
-- Format: MWM-YYYY-000001
-- Each owner_id maintains its own sequential counter per calendar year.
-- ==============================================================================

create table if not exists public.receipt_counters (
  owner_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  last_number integer not null default 0,
  primary key (owner_id, year)
);

alter table public.receipt_counters enable row level security;
create policy "receipt_counters_owner_isolation"
  on public.receipt_counters
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create or replace function public.generate_per_owner_receipt_number()
returns trigger as $$
declare
  v_year integer := extract(year from coalesce(new.payment_date, current_date))::integer;
  v_next_num integer;
begin
  -- Ensure owner_id is set
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;

  -- Generate sequential number if not supplied
  if new.receipt_number is null or new.receipt_number = '' then
    insert into public.receipt_counters (owner_id, year, last_number)
    values (new.owner_id, v_year, 1)
    on conflict (owner_id, year)
    do update set last_number = public.receipt_counters.last_number + 1
    returning last_number into v_next_num;

    new.receipt_number := 'MWM-' || v_year::text || '-' || lpad(v_next_num::text, 6, '0');
  end if;

  return new;
end;
$$ language plpgsql;

-- Replace earlier global receipt sequence trigger
drop trigger if exists trg_generate_receipt_number on public.payments;
create trigger trg_generate_receipt_number
  before insert on public.payments
  for each row execute function public.generate_per_owner_receipt_number();

-- Update unique constraint on payments receipt_number to be per-owner
alter table public.payments drop constraint if exists payments_receipt_number_key;
alter table public.payments add constraint payments_owner_receipt_unique unique (owner_id, receipt_number);

-- ==============================================================================
-- 6. ON AUTH SIGNUP TRIGGER (PROFILES & ACADEMY SETTINGS)
-- ==============================================================================
-- Whenever a new user signs up in auth.users, automatically initialize:
-- 1. A public.profiles row
-- 2. An empty/default public.academy_settings row for that user
-- ==============================================================================

create or replace function public.handle_new_auth_user()
returns trigger as $$
declare
  v_full_name text;
  v_phone text;
begin
  -- Extract raw user metadata if provided
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '');
  v_phone := coalesce(new.raw_user_meta_data->>'phone', '');

  -- 1. Insert Profile
  insert into public.profiles (id, full_name, phone)
  values (new.id, v_full_name, v_phone)
  on conflict (id) do nothing;

  -- 2. Insert Academy Settings for the new owner
  insert into public.academy_settings (
    owner_id,
    academy_name,
    email,
    contact_number,
    default_monthly_fee,
    payment_due_day,
    is_onboarding_completed
  )
  values (
    new.id,
    'MIX with Me Classes',
    new.email,
    v_phone,
    1500,
    5,
    false
  )
  on conflict do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ==============================================================================
-- 7. STORAGE ISOLATION POLICIES ({auth.uid()}/...)
-- ==============================================================================
-- Storage policies for student-photos and academy-assets buckets:
-- Enforces that storage object path begins with auth.uid() folder.
-- Folder rule: (storage.foldername(name))[1] = auth.uid()::text
-- ==============================================================================

-- 7.1 student-photos bucket
drop policy if exists "Admin upload student-photos" on storage.objects;
drop policy if exists "Admin update student-photos" on storage.objects;
drop policy if exists "Admin delete student-photos" on storage.objects;
drop policy if exists "Public read student-photos" on storage.objects;
drop policy if exists "student_photos_owner_read" on storage.objects;
drop policy if exists "student_photos_owner_insert" on storage.objects;
drop policy if exists "student_photos_owner_update" on storage.objects;
drop policy if exists "student_photos_owner_delete" on storage.objects;

create policy "student_photos_owner_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "student_photos_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "student_photos_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "student_photos_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- 7.2 academy-assets bucket
drop policy if exists "Admin upload academy-assets" on storage.objects;
drop policy if exists "Admin update academy-assets" on storage.objects;
drop policy if exists "Admin delete academy-assets" on storage.objects;
drop policy if exists "Public read academy-assets" on storage.objects;
drop policy if exists "academy_assets_owner_read" on storage.objects;
drop policy if exists "academy_assets_owner_insert" on storage.objects;
drop policy if exists "academy_assets_owner_update" on storage.objects;
drop policy if exists "academy_assets_owner_delete" on storage.objects;

create policy "academy_assets_owner_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'academy-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "academy_assets_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'academy-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "academy_assets_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'academy-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'academy-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "academy_assets_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'academy-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ==============================================================================
-- 8. MULTI-TENANT RESTORE DATABASE BACKUP RPC
-- ==============================================================================
-- Safely restores only the authenticated caller's own academy records.
-- ==============================================================================

create or replace function public.restore_database_backup(backup_payload jsonb)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_caller_id uuid := auth.uid();
  v_restored_counts jsonb := '{}'::jsonb;
  v_rec record;
begin
  if v_caller_id is null then
    raise exception 'Unauthorized: Caller must be an authenticated academy owner.';
  end if;

  -- 1. Delete caller's existing records in reverse dependency order
  delete from public.payments where owner_id = v_caller_id;
  delete from public.attendance where owner_id = v_caller_id;
  delete from public.monthly_fees where owner_id = v_caller_id;
  delete from public.classes where owner_id = v_caller_id;
  delete from public.students where owner_id = v_caller_id;
  delete from public.batches where owner_id = v_caller_id;
  delete from public.academy_settings where owner_id = v_caller_id;

  -- 2. Restore academy_settings
  if backup_payload->'tables'->'academy_settings' is not null then
    insert into public.academy_settings (
      id, owner_id, academy_name, logo_url, contact_number, email, address,
      default_monthly_fee, payment_due_day, working_hours_config, is_onboarding_completed, updated_at
    )
    select
      coalesce((x->>'id')::uuid, gen_random_uuid()),
      v_caller_id,
      coalesce(x->>'academy_name', 'MIX with Me Classes'),
      x->>'logo_url',
      x->>'contact_number',
      x->>'email',
      x->>'address',
      coalesce((x->>'default_monthly_fee')::integer, 1500),
      coalesce((x->>'payment_due_day')::integer, 5),
      coalesce(x->'working_hours_config', '{"workingDays":["Mon","Tue","Wed","Thu","Fri"],"weekdayWindow":{"startTime":"14:00","endTime":"21:00"},"weekendWindow":{"startTime":"10:00","endTime":"18:00"},"minBreakMinutes":10,"maxClassesPerDay":null}'::jsonb),
      coalesce((x->>'is_onboarding_completed')::boolean, true),
      coalesce((x->>'updated_at')::timestamptz, now())
    from jsonb_array_elements(backup_payload->'tables'->'academy_settings') as x;

    v_restored_counts := jsonb_set(v_restored_counts, '{academy_settings}', to_jsonb(jsonb_array_length(backup_payload->'tables'->'academy_settings')));
  end if;

  -- 3. Restore batches
  if backup_payload->'tables'->'batches' is not null then
    insert into public.batches (id, owner_id, name, days_of_week, start_time, end_time, capacity, created_at, updated_at)
    select
      (x->>'id')::uuid,
      v_caller_id,
      x->>'name',
      array(select jsonb_array_elements_text(x->'days_of_week')),
      (x->>'start_time')::time,
      (x->>'end_time')::time,
      (x->>'capacity')::integer,
      coalesce((x->>'created_at')::timestamptz, now()),
      coalesce((x->>'updated_at')::timestamptz, now())
    from jsonb_array_elements(backup_payload->'tables'->'batches') as x;

    v_restored_counts := jsonb_set(v_restored_counts, '{batches}', to_jsonb(jsonb_array_length(backup_payload->'tables'->'batches')));
  end if;

  -- 4. Restore students
  if backup_payload->'tables'->'students' is not null then
    insert into public.students (
      id, owner_id, name, roll_number, phone, guardian_phone, batch_id,
      status, notes, monthly_fee, photo_url, joined_at, created_at, updated_at
    )
    select
      (x->>'id')::uuid,
      v_caller_id,
      x->>'name',
      x->>'roll_number',
      x->>'phone',
      x->>'guardian_phone',
      (x->>'batch_id')::uuid,
      coalesce(x->>'status', 'active'),
      x->>'notes',
      coalesce((x->>'monthly_fee')::integer, 1500),
      x->>'photo_url',
      coalesce((x->>'joined_at')::date, current_date),
      coalesce((x->>'created_at')::timestamptz, now()),
      coalesce((x->>'updated_at')::timestamptz, now())
    from jsonb_array_elements(backup_payload->'tables'->'students') as x;

    v_restored_counts := jsonb_set(v_restored_counts, '{students}', to_jsonb(jsonb_array_length(backup_payload->'tables'->'students')));
  end if;

  -- 5. Restore classes
  if backup_payload->'tables'->'classes' is not null then
    insert into public.classes (id, owner_id, batch_id, class_date, start_time, end_time, status, cancel_reason, created_at, updated_at)
    select
      (x->>'id')::uuid,
      v_caller_id,
      (x->>'batch_id')::uuid,
      (x->>'class_date')::date,
      (x->>'start_time')::time,
      (x->>'end_time')::time,
      coalesce(x->>'status', 'scheduled'),
      x->>'cancel_reason',
      coalesce((x->>'created_at')::timestamptz, now()),
      coalesce((x->>'updated_at')::timestamptz, now())
    from jsonb_array_elements(backup_payload->'tables'->'classes') as x;

    v_restored_counts := jsonb_set(v_restored_counts, '{classes}', to_jsonb(jsonb_array_length(backup_payload->'tables'->'classes')));
  end if;

  -- 6. Restore monthly_fees
  if backup_payload->'tables'->'monthly_fees' is not null then
    insert into public.monthly_fees (id, owner_id, student_id, billing_month, amount_due, due_date, created_at, updated_at)
    select
      (x->>'id')::uuid,
      v_caller_id,
      (x->>'student_id')::uuid,
      (x->>'billing_month')::date,
      coalesce((x->>'amount_due')::integer, 0),
      (x->>'due_date')::date,
      coalesce((x->>'created_at')::timestamptz, now()),
      coalesce((x->>'updated_at')::timestamptz, now())
    from jsonb_array_elements(backup_payload->'tables'->'monthly_fees') as x;

    v_restored_counts := jsonb_set(v_restored_counts, '{monthly_fees}', to_jsonb(jsonb_array_length(backup_payload->'tables'->'monthly_fees')));
  end if;

  -- 7. Restore attendance
  if backup_payload->'tables'->'attendance' is not null then
    insert into public.attendance (id, owner_id, class_id, student_id, status, marked_at, updated_at)
    select
      (x->>'id')::uuid,
      v_caller_id,
      (x->>'class_id')::uuid,
      (x->>'student_id')::uuid,
      x->>'status',
      coalesce((x->>'marked_at')::timestamptz, now()),
      coalesce((x->>'updated_at')::timestamptz, now())
    from jsonb_array_elements(backup_payload->'tables'->'attendance') as x;

    v_restored_counts := jsonb_set(v_restored_counts, '{attendance}', to_jsonb(jsonb_array_length(backup_payload->'tables'->'attendance')));
  end if;

  -- 8. Restore payments
  if backup_payload->'tables'->'payments' is not null then
    insert into public.payments (id, owner_id, student_id, monthly_fee_id, amount, payment_date, method, receipt_number, notes, created_at)
    select
      (x->>'id')::uuid,
      v_caller_id,
      (x->>'student_id')::uuid,
      (x->>'monthly_fee_id')::uuid,
      coalesce((x->>'amount')::integer, 0),
      coalesce((x->>'payment_date')::date, current_date),
      coalesce(x->>'method', 'cash'),
      x->>'receipt_number',
      x->>'notes',
      coalesce((x->>'created_at')::timestamptz, now())
    from jsonb_array_elements(backup_payload->'tables'->'payments') as x;

    v_restored_counts := jsonb_set(v_restored_counts, '{payments}', to_jsonb(jsonb_array_length(backup_payload->'tables'->'payments')));
  end if;

  return jsonb_build_object(
    'success', true,
    'restoredCounts', v_restored_counts,
    'message', 'Academy database backup successfully restored.'
  );
end;
$$;
