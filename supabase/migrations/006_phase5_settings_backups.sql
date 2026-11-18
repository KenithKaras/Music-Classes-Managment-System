-- Migration: 006_phase5_settings_backups.sql
-- Description: Phase 5 schema for "MIX with Me Classes" - Settings, Backups & Restore
-- 1. Creates storage bucket "academy-assets" with admin-only write permissions.
-- 2. Creates transactional RPC function "restore_database_backup" to restore database backups atomically.

-- ==============================================================================
-- 1. STORAGE BUCKET: academy-assets
-- ==============================================================================
-- Stores academy logo and branding assets.
-- Public read for fast CDN delivery and receipt rendering.
-- Admin-only insert, update, and delete.
-- Max file size: 2 MB (2,097,152 bytes).
-- Allowed types: image/jpeg, image/png, image/webp.
-- ==============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academy-assets',
  'academy-assets',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS Policy 1: Anyone can view academy assets
drop policy if exists "Public read academy-assets" on storage.objects;
create policy "Public read academy-assets"
  on storage.objects
  for select
  using (bucket_id = 'academy-assets');

-- Storage RLS Policy 2: Only authenticated admin can upload academy assets
drop policy if exists "Admin upload academy-assets" on storage.objects;
create policy "Admin upload academy-assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'academy-assets'
    and exists (
      select 1 from public.admin_users
      where admin_users.email = (select auth.jwt() ->> 'email')
    )
  );

-- Storage RLS Policy 3: Only authenticated admin can update academy assets
drop policy if exists "Admin update academy-assets" on storage.objects;
create policy "Admin update academy-assets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'academy-assets'
    and exists (
      select 1 from public.admin_users
      where admin_users.email = (select auth.jwt() ->> 'email')
    )
  );

-- Storage RLS Policy 4: Only authenticated admin can delete academy assets
drop policy if exists "Admin delete academy-assets" on storage.objects;
create policy "Admin delete academy-assets"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'academy-assets'
    and exists (
      select 1 from public.admin_users
      where admin_users.email = (select auth.jwt() ->> 'email')
    )
  );

-- ==============================================================================
-- 2. TRANSACTIONAL RESTORE FUNCTION (RPC)
-- ==============================================================================
-- Function: restore_database_backup(backup_payload jsonb)
--
-- HOW IT WORKS:
-- 1. Security Check: Ensures the caller's email is present in public.admin_users.
-- 2. Atomic Transaction: PL/pgSQL function runs within a single transaction.
--    Any constraint violation or error immediately rolls back ALL modifications.
-- 3. Temporarily disables user-defined triggers (or sets replica role) to allow
--    restoring valid historical data (including pre-generated sequential receipt numbers).
-- 4. Clears existing data in REVERSE dependency order:
--    payments -> attendance -> monthly_fees -> classes -> students -> batches -> academy_settings.
-- 5. Restores data in DEPENDENCY order:
--    academy_settings -> batches -> students -> classes -> monthly_fees -> attendance -> payments.
-- 6. Resynchronizes receipt_number_seq so future payments continue sequentially without duplicate collisions.
-- 7. Returns a JSON summary of restored row counts.
-- ==============================================================================

create or replace function public.restore_database_backup(backup_payload jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_admin_email text;
  v_tables jsonb;
  v_restored_counts jsonb := '{}'::jsonb;
  v_settings_count int := 0;
  v_batches_count int := 0;
  v_students_count int := 0;
  v_classes_count int := 0;
  v_fees_count int := 0;
  v_attendance_count int := 0;
  v_payments_count int := 0;
  v_max_receipt_seq bigint := 0;
begin
  -- 1. Verify authenticated admin permission
  v_admin_email := (select auth.jwt() ->> 'email');
  if v_admin_email is null or not exists (
    select 1 from public.admin_users where email = v_admin_email
  ) then
    raise exception 'Unauthorized: Only authorized admin users can restore database backups.';
  end if;

  -- 2. Validate payload structure
  if backup_payload is null or not (backup_payload ? 'tables') then
    raise exception 'Invalid backup payload: missing "tables" property.';
  end if;

  v_tables := backup_payload->'tables';

  -- 3. Set session replication role to replica to safely import foreign keys and pre-existing IDs
  set local session_replication_role = 'replica';

  -- 4. Delete existing data in reverse dependency order
  delete from public.payments;
  delete from public.attendance;
  delete from public.monthly_fees;
  delete from public.classes;
  delete from public.students;
  delete from public.batches;
  delete from public.academy_settings;

  -- 5. Insert in dependency order

  -- A. Academy Settings
  if v_tables ? 'academy_settings' and jsonb_typeof(v_tables->'academy_settings') = 'array' and jsonb_array_length(v_tables->'academy_settings') > 0 then
    insert into public.academy_settings
    select * from jsonb_populate_recordset(null::public.academy_settings, v_tables->'academy_settings');
    get diagnostics v_settings_count = row_count;
  end if;

  -- B. Batches
  if v_tables ? 'batches' and jsonb_typeof(v_tables->'batches') = 'array' and jsonb_array_length(v_tables->'batches') > 0 then
    insert into public.batches
    select * from jsonb_populate_recordset(null::public.batches, v_tables->'batches');
    get diagnostics v_batches_count = row_count;
  end if;

  -- C. Students
  if v_tables ? 'students' and jsonb_typeof(v_tables->'students') = 'array' and jsonb_array_length(v_tables->'students') > 0 then
    insert into public.students
    select * from jsonb_populate_recordset(null::public.students, v_tables->'students');
    get diagnostics v_students_count = row_count;
  end if;

  -- D. Classes
  if v_tables ? 'classes' and jsonb_typeof(v_tables->'classes') = 'array' and jsonb_array_length(v_tables->'classes') > 0 then
    insert into public.classes
    select * from jsonb_populate_recordset(null::public.classes, v_tables->'classes');
    get diagnostics v_classes_count = row_count;
  end if;

  -- E. Monthly Fees
  if v_tables ? 'monthly_fees' and jsonb_typeof(v_tables->'monthly_fees') = 'array' and jsonb_array_length(v_tables->'monthly_fees') > 0 then
    insert into public.monthly_fees
    select * from jsonb_populate_recordset(null::public.monthly_fees, v_tables->'monthly_fees');
    get diagnostics v_fees_count = row_count;
  end if;

  -- F. Attendance
  if v_tables ? 'attendance' and jsonb_typeof(v_tables->'attendance') = 'array' and jsonb_array_length(v_tables->'attendance') > 0 then
    insert into public.attendance
    select * from jsonb_populate_recordset(null::public.attendance, v_tables->'attendance');
    get diagnostics v_attendance_count = row_count;
  end if;

  -- G. Payments
  if v_tables ? 'payments' and jsonb_typeof(v_tables->'payments') = 'array' and jsonb_array_length(v_tables->'payments') > 0 then
    insert into public.payments
    select * from jsonb_populate_recordset(null::public.payments, v_tables->'payments');
    get diagnostics v_payments_count = row_count;
  end if;

  -- 6. Resynchronize receipt_number_seq to the highest receipt number in payments
  select coalesce(max(nullif(regexp_replace(receipt_number, '^MWM-\d{4}-0*', ''), '')::bigint), 0)
  into v_max_receipt_seq
  from public.payments;

  if v_max_receipt_seq > 0 then
    perform setval('public.receipt_number_seq', v_max_receipt_seq, true);
  else
    perform setval('public.receipt_number_seq', 1, false);
  end if;

  -- 7. Reset session replication role back to default
  set local session_replication_role = 'origin';

  -- Build return payload
  v_restored_counts := jsonb_build_object(
    'academy_settings', v_settings_count,
    'batches', v_batches_count,
    'students', v_students_count,
    'classes', v_classes_count,
    'monthly_fees', v_fees_count,
    'attendance', v_attendance_count,
    'payments', v_payments_count
  );

  return jsonb_build_object(
    'success', true,
    'restored_counts', v_restored_counts,
    'timestamp', now()
  );
exception
  when others then
    -- Reset replication role in case of error
    set local session_replication_role = 'origin';
    raise exception 'Restore failed and was rolled back: %', sqlerrm;
end;
$$;

-- Grant execution to authenticated users
grant execute on function public.restore_database_backup(jsonb) to authenticated;
