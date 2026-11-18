-- ==============================================================================
-- Migration: 010b_fix_dashboard_owner.sql
-- Description: Security hardening for get_dashboard_summary RPC:
-- 1. Strictly enforces auth.uid() for any authenticated app user.
-- 2. Honors p_owner_id ONLY when caller JWT role is service_role (coalesce(auth.role(), '') = 'service_role').
--    (Note: inside security definer, current_user is the function owner, so auth.role() is required).
-- 3. Explicitly revokes public/anon access and restricts execution to authenticated.
-- ==============================================================================

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
  -- Secure owner resolution:
  -- - For any authenticated app user, always use auth.uid()
  -- - Inside security definer, current_user is the function owner, so check auth.role()
  -- - p_owner_id parameter is only honored when caller role is service_role
  if v_caller_id is not null then
    v_owner_id := v_caller_id;
  elsif p_owner_id is not null and coalesce(auth.role(), '') = 'service_role' then
    v_owner_id := p_owner_id;
  else
    raise exception 'Not authenticated';
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

-- Revoke all permissions from public and anon
revoke all on function public.get_dashboard_summary(uuid) from public, anon;

-- Grant execution to authenticated and service_role
grant execute on function public.get_dashboard_summary(uuid) to authenticated;
grant execute on function public.get_dashboard_summary(uuid) to service_role;
