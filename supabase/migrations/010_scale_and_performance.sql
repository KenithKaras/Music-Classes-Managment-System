-- ==============================================================================
-- Migration: 010_scale_and_performance.sql (v2 - Schema-Verified)
-- Description: Scale optimizations, cached RLS subqueries, safe index generation,
-- and consolidated get_dashboard_summary() RPC function.
--
-- Verified against real schema from migrations 001 to 009:
-- - monthly_fees: Uses amount_due and joins with payments for paid/balance (no status/amount_paid columns).
-- - attendance: Uses marked_at for historical timestamp indexing.
-- - All tables: Strictly isolated by owner_id = (select auth.uid()).
-- ==============================================================================

-- ==============================================================================
-- 1. UPDATE RLS POLICIES TO USE (SELECT auth.uid()) CACHED SUBQUERIES
-- ==============================================================================
-- Using (select auth.uid()) allows PostgreSQL to evaluate and cache the user's
-- identity once per statement rather than re-evaluating auth.uid() per row.

do $$
begin
  -- 1.1 profiles
  drop policy if exists "Users can view own profile" on public.profiles;
  create policy "Users can view own profile"
    on public.profiles for select to authenticated
    using (id = (select auth.uid()));

  drop policy if exists "Users can update own profile" on public.profiles;
  create policy "Users can update own profile"
    on public.profiles for update to authenticated
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));

  -- 1.2 academy_settings
  drop policy if exists "academy_settings_owner_isolation" on public.academy_settings;
  create policy "academy_settings_owner_isolation"
    on public.academy_settings for all to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

  -- 1.3 batches
  drop policy if exists "batches_owner_isolation" on public.batches;
  create policy "batches_owner_isolation"
    on public.batches for all to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

  -- 1.4 students
  drop policy if exists "students_owner_isolation" on public.students;
  create policy "students_owner_isolation"
    on public.students for all to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

  -- 1.5 classes
  drop policy if exists "classes_owner_isolation" on public.classes;
  create policy "classes_owner_isolation"
    on public.classes for all to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

  -- 1.6 attendance
  drop policy if exists "attendance_owner_isolation" on public.attendance;
  create policy "attendance_owner_isolation"
    on public.attendance for all to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

  -- 1.7 monthly_fees
  drop policy if exists "monthly_fees_owner_isolation" on public.monthly_fees;
  create policy "monthly_fees_owner_isolation"
    on public.monthly_fees for all to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

  -- 1.8 payments
  drop policy if exists "payments_owner_isolation" on public.payments;
  create policy "payments_owner_isolation"
    on public.payments for all to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));
end $$;

-- Drop obsolete or incorrect indexes from prior runs if any
drop index if exists public.idx_monthly_fees_owner_status_due;

-- ==============================================================================
-- 2. SAFE SCALE INDEX CREATION (ELIMINATES SEQUENTIAL SCANS ON LARGE DATASETS)
-- ==============================================================================
-- Wrapped in an exception-handled loop so that one issue never stops the rest.

do $$
declare
  v_statements text[] := array[
    -- 2.1 Students
    'create index if not exists idx_students_owner_status_batch on public.students (owner_id, status, batch_id)',
    'create index if not exists idx_students_owner_enrollment on public.students (owner_id, enrollment_date)',
    'create index if not exists idx_students_owner_fullname on public.students (owner_id, full_name)',
    'create index if not exists idx_students_owner_created_at on public.students (owner_id, created_at desc)',

    -- 2.2 Batches
    'create index if not exists idx_batches_owner_name on public.batches (owner_id, name)',
    'create index if not exists idx_batches_owner_created_at on public.batches (owner_id, created_at desc)',

    -- 2.3 Classes
    'create index if not exists idx_classes_owner_date_time on public.classes (owner_id, class_date, start_time)',
    'create index if not exists idx_classes_owner_batch_date on public.classes (owner_id, batch_id, class_date)',
    'create index if not exists idx_classes_owner_status on public.classes (owner_id, status)',

    -- 2.4 Attendance
    'create index if not exists idx_attendance_owner_class_student on public.attendance (owner_id, class_id, student_id)',
    'create index if not exists idx_attendance_class_status on public.attendance (class_id, status)',
    'create index if not exists idx_attendance_student_status on public.attendance (student_id, status)',
    'create index if not exists idx_attendance_owner_marked_at on public.attendance (owner_id, marked_at desc)',

    -- 2.5 Monthly fees (only real columns: owner_id, billing_month, student_id, due_date)
    'create index if not exists idx_monthly_fees_owner_month on public.monthly_fees (owner_id, billing_month)',
    'create index if not exists idx_monthly_fees_owner_student_month on public.monthly_fees (owner_id, student_id, billing_month)',
    'create index if not exists idx_monthly_fees_owner_due_date on public.monthly_fees (owner_id, due_date)',

    -- 2.6 Payments
    'create index if not exists idx_payments_owner_date on public.payments (owner_id, payment_date desc)',
    'create index if not exists idx_payments_owner_student on public.payments (owner_id, student_id)',
    'create index if not exists idx_payments_owner_fee on public.payments (owner_id, monthly_fee_id)',
    'create index if not exists idx_payments_owner_created_at on public.payments (owner_id, created_at desc)'
  ];
  sql_cmd text;
begin
  foreach sql_cmd in array v_statements loop
    begin
      execute sql_cmd;
    exception when others then
      raise notice 'Notice: Skipped index statement [%]: % (SQLSTATE: %)', sql_cmd, sqlerrm, sqlstate;
    end;
  end loop;
end $$;

-- Optional created_at index for attendance if migration 009 was executed
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'attendance' and column_name = 'created_at'
  ) then
    execute 'create index if not exists idx_attendance_owner_created_at on public.attendance (owner_id, created_at desc)';
  end if;
exception when others then
  raise notice 'Notice: Skipped optional idx_attendance_owner_created_at: %', sqlerrm;
end $$;

-- ==============================================================================
-- 3. CONSOLIDATED DASHBOARD RPC FOR MAXIMUM QUERY PERFORMANCE
-- ==============================================================================
-- Returns all required summary metrics in a single roundtrip to PostgreSQL.
-- Uses ONLY columns that actually exist:
--   - Billed, collected, pending are computed by joining monthly_fees with payments.
--   - If caller is authenticated, auth.uid() is strictly enforced.
--   - When tested in SQL Editor as postgres/service_role, optional p_owner_id can be passed.

create or replace function public.get_dashboard_summary(p_owner_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := (select auth.uid());
  v_owner_id uuid;
  v_today date := current_date;
  v_month_start date := date_trunc('month', current_date)::date;
  v_month_end date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;

  v_active_students integer := 0;
  v_total_batches integer := 0;
  v_today_classes integer := 0;
  v_today_cancelled integer := 0;

  v_billed_month numeric := 0;
  v_collected_month numeric := 0;
  v_pending_balance numeric := 0;

  v_month_present integer := 0;
  v_month_total_attendance integer := 0;
  v_attendance_rate numeric := 100.0;

  v_recent_payments jsonb := '[]'::jsonb;
  v_today_class_list jsonb := '[]'::jsonb;
begin
  -- Resolve owner: strictly use auth.uid() when called by an authenticated user
  if v_caller_id is not null then
    v_owner_id := v_caller_id;
  elsif p_owner_id is not null then
    v_owner_id := p_owner_id;
  else
    raise exception 'Not authenticated: user session not found and no owner_id provided';
  end if;

  -- 1. Active students count
  select count(*) into v_active_students
  from public.students
  where owner_id = v_owner_id and status = 'active';

  -- 2. Batches count
  select count(*) into v_total_batches
  from public.batches
  where owner_id = v_owner_id;

  -- 3. Today's classes count and cancelled count
  select 
    count(*),
    count(*) filter (where status = 'cancelled')
  into v_today_classes, v_today_cancelled
  from public.classes
  where owner_id = v_owner_id and class_date = v_today;

  -- 4. Monthly Fee Metrics (billed, collected, pending for current month)
  -- monthly_fees table has amount_due; paid amount and balance are computed from payments
  with fee_payments as (
    select 
      mf.id as fee_id,
      mf.amount_due,
      coalesce(sum(p.amount), 0) as paid_amount
    from public.monthly_fees mf
    left join public.payments p 
      on p.monthly_fee_id = mf.id 
     and p.owner_id = v_owner_id
    where mf.owner_id = v_owner_id 
      and mf.billing_month = v_month_start
    group by mf.id, mf.amount_due
  )
  select 
    coalesce(sum(amount_due), 0),
    coalesce(sum(paid_amount), 0),
    coalesce(sum(greatest(0, amount_due - paid_amount)), 0)
  into v_billed_month, v_collected_month, v_pending_balance
  from fee_payments;

  -- 5. Monthly Attendance Rate
  select 
    count(*) filter (where a.status = 'present'),
    count(*)
  into v_month_present, v_month_total_attendance
  from public.attendance a
  join public.classes c on c.id = a.class_id
  where a.owner_id = v_owner_id and c.class_date between v_month_start and v_month_end;

  if v_month_total_attendance > 0 then
    v_attendance_rate := round((v_month_present::numeric / v_month_total_attendance::numeric) * 100.0, 1);
  end if;

  -- 6. Recent Payments (Latest 5)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'amount', p.amount,
        'payment_date', p.payment_date,
        'receipt_number', p.receipt_number,
        'student_name', coalesce(s.full_name, 'Unknown Student')
      ) order by p.payment_date desc, p.created_at desc
    ),
    '[]'::jsonb
  )
  into v_recent_payments
  from (
    select id, student_id, amount, payment_date, receipt_number, created_at
    from public.payments
    where owner_id = v_owner_id
    order by payment_date desc, created_at desc
    limit 5
  ) p
  left join public.students s on s.id = p.student_id;

  -- 7. Today's classes with batch name
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'class_date', c.class_date,
        'start_time', c.start_time,
        'end_time', c.end_time,
        'status', c.status,
        'batch_id', c.batch_id,
        'batch_name', b.name
      ) order by c.start_time asc
    ),
    '[]'::jsonb
  )
  into v_today_class_list
  from public.classes c
  join public.batches b on b.id = c.batch_id
  where c.owner_id = v_owner_id and c.class_date = v_today;

  -- Return consolidated JSON payload with all expected keys
  return jsonb_build_object(
    'active_students', v_active_students,
    'total_batches', v_total_batches,
    'today_classes_count', v_today_classes,
    'today_cancelled_count', v_today_cancelled,
    'today_classes', v_today_class_list,
    'today_class_list', v_today_class_list,
    'today_cancelled', v_today_cancelled,
    'billed_month', v_billed_month,
    'collected_month', v_collected_month,
    'pending_balance', v_pending_balance,
    'attendance_rate', v_attendance_rate,
    'recent_payments', v_recent_payments
  );
end;
$$;

-- Grant execution to authenticated users
grant execute on function public.get_dashboard_summary(uuid) to authenticated;

-- ==============================================================================
-- 4. VERIFICATION QUERY
-- ==============================================================================
-- Run this query to inspect and confirm all created indexes exist
select 
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_students_owner_status_batch',
    'idx_students_owner_enrollment',
    'idx_students_owner_fullname',
    'idx_students_owner_created_at',
    'idx_batches_owner_name',
    'idx_batches_owner_created_at',
    'idx_classes_owner_date_time',
    'idx_classes_owner_batch_date',
    'idx_classes_owner_status',
    'idx_attendance_owner_class_student',
    'idx_attendance_class_status',
    'idx_attendance_student_status',
    'idx_attendance_owner_marked_at',
    'idx_monthly_fees_owner_month',
    'idx_monthly_fees_owner_student_month',
    'idx_monthly_fees_owner_due_date',
    'idx_payments_owner_date',
    'idx_payments_owner_student',
    'idx_payments_owner_fee',
    'idx_payments_owner_created_at'
  )
order by tablename, indexname;
