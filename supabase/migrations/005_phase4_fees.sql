-- Migration: 005_phase4_fees.sql
-- Description: Phase 4 schema for "MIX with Me Classes" - Fees, Payments, and Receipts
-- Creates monthly_fees table, payments table, sequential receipt generation,
-- overpayment prevention trigger, idempotent monthly fee generation function, and RLS policies.

-- ==============================================================================
-- 1. MONTHLY FEES TABLE
-- ==============================================================================
-- Stores monthly fee obligations per student.
-- billing_month is normalized to the 1st of each month (e.g. 2026-11-01).
-- amount_due is copied from students.monthly_fee at creation time.
-- unique (student_id, billing_month) guarantees no duplicate fee records for the same month.
-- ==============================================================================
create table if not exists public.monthly_fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  billing_month date not null check (extract(day from billing_month) = 1),
  amount_due integer not null check (amount_due >= 0),
  due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_fees_student_month_unique unique (student_id, billing_month)
);

-- Performance Indexes
create index if not exists monthly_fees_billing_month_idx on public.monthly_fees (billing_month desc);
create index if not exists monthly_fees_student_id_idx on public.monthly_fees (student_id);

-- Auto-update updated_at trigger for monthly_fees
drop trigger if exists update_monthly_fees_updated_at on public.monthly_fees;
create trigger update_monthly_fees_updated_at
  before update on public.monthly_fees
  for each row
  execute function public.update_updated_at_column();

-- ==============================================================================
-- 2. RECEIPT SEQUENCE & PAYMENTS TABLE
-- ==============================================================================
-- Sequence for generating sequential receipt numbers in format MWM-YYYY-000001
-- ==============================================================================
create sequence if not exists public.receipt_number_seq start with 1 increment by 1;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  monthly_fee_id uuid not null references public.monthly_fees(id) on delete restrict,
  amount integer not null check (amount > 0),
  payment_date date not null default current_date,
  method text not null check (method in ('cash', 'upi', 'bank_transfer', 'card', 'other')),
  receipt_number text unique not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Performance Indexes
create index if not exists payments_student_id_idx on public.payments (student_id);
create index if not exists payments_monthly_fee_id_idx on public.payments (monthly_fee_id);
create index if not exists payments_payment_date_idx on public.payments (payment_date desc);

-- ==============================================================================
-- 3. AUTOMATIC RECEIPT NUMBER GENERATION (DATABASE-LEVEL)
-- ==============================================================================
-- Generates unique sequential receipt numbers formatted as MWM-YYYY-000001
-- e.g. MWM-2026-000001, MWM-2026-000002.
-- Guarantees integrity without relying on client-side generation.
-- ==============================================================================
create or replace function public.generate_receipt_number()
returns trigger as $$
declare
  v_year text;
  v_seq bigint;
begin
  if new.receipt_number is null or new.receipt_number = '' then
    v_year := to_char(coalesce(new.payment_date, current_date), 'YYYY');
    v_seq := nextval('public.receipt_number_seq');
    new.receipt_number := 'MWM-' || v_year || '-' || lpad(v_seq::text, 6, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_receipt_number_trigger on public.payments;
create trigger set_receipt_number_trigger
  before insert on public.payments
  for each row
  execute function public.generate_receipt_number();

-- ==============================================================================
-- 4. OVERPAYMENT PREVENTION TRIGGER
-- ==============================================================================
-- HOW IT WORKS:
-- When a payment is recorded or updated, this trigger queries the amount_due from
-- monthly_fees and sums all existing payments for that monthly_fee_id.
-- If the existing payments + the new payment amount exceed amount_due, it raises an
-- exception and rolls back the transaction.
-- This guarantees at the database level that total payments for any monthly fee
-- can never exceed amount_due, while seamlessly allowing partial payments.
-- ==============================================================================
create or replace function public.validate_payment_amount()
returns trigger as $$
declare
  v_amount_due integer;
  v_already_paid integer;
begin
  select amount_due into v_amount_due
  from public.monthly_fees
  where id = new.monthly_fee_id;

  if not found then
    raise exception 'Monthly fee record not found for id: %', new.monthly_fee_id;
  end if;

  select coalesce(sum(amount), 0) into v_already_paid
  from public.payments
  where monthly_fee_id = new.monthly_fee_id
    and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if (v_already_paid + new.amount) > v_amount_due then
    raise exception 'Payment exceeds remaining balance: Amount due is ₹%, already paid is ₹%, attempted payment is ₹% (balance remaining: ₹%)',
      v_amount_due, v_already_paid, new.amount, (v_amount_due - v_already_paid);
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists validate_payment_amount_trigger on public.payments;
create trigger validate_payment_amount_trigger
  before insert or update on public.payments
  for each row
  execute function public.validate_payment_amount();

-- ==============================================================================
-- 5. MONTHLY FEE GENERATION FUNCTION (RPC)
-- ==============================================================================
-- Creates monthly_fees rows for all ACTIVE students for target_month.
-- IDEMPOTENT: ON CONFLICT (student_id, billing_month) DO NOTHING ensures running
-- it multiple times creates 0 duplicates.
-- Copies students.monthly_fee as amount_due for each student.
-- Sets due_date using academy_settings.payment_due_day (defaulting to 5th).
-- ==============================================================================
create or replace function public.generate_monthly_fees(target_month date)
returns integer
language plpgsql
security definer
as $$
declare
  v_billing_month date;
  v_due_day integer;
  v_due_date date;
  v_inserted_count integer := 0;
begin
  -- Normalize to the 1st of the month
  v_billing_month := date_trunc('month', target_month)::date;

  -- Read payment_due_day from academy_settings (between 1 and 28)
  select coalesce(payment_due_day, 5) into v_due_day
  from public.academy_settings
  limit 1;

  if v_due_day is null or v_due_day < 1 or v_due_day > 28 then
    v_due_day := 5;
  end if;

  v_due_date := make_date(
    extract(year from v_billing_month)::int,
    extract(month from v_billing_month)::int,
    v_due_day
  );

  -- Insert monthly_fees for all active students (skips already existing records)
  with inserted as (
    insert into public.monthly_fees (
      student_id,
      billing_month,
      amount_due,
      due_date
    )
    select 
      s.id,
      v_billing_month,
      s.monthly_fee,
      v_due_date
    from public.students s
    where s.status = 'active'
    on conflict (student_id, billing_month) do nothing
    returning id
  )
  select count(*) into v_inserted_count from inserted;

  return v_inserted_count;
end;
$$;

-- Grant execution to authenticated admin
grant execute on function public.generate_monthly_fees(date) to authenticated;

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ==============================================================================
alter table public.monthly_fees enable row level security;
alter table public.payments enable row level security;

-- Admin-only access to monthly_fees
create policy "Allow authenticated admin full access to monthly_fees"
  on public.monthly_fees
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

-- Admin-only access to payments
create policy "Allow authenticated admin full access to payments"
  on public.payments
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
