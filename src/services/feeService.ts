import { supabase } from '../lib/supabase';
import type {
  MonthlyFee,
  FeeStatus,
  MonthlyFinancialSummary,
  MonthlyIncomeDataPoint,
  Payment,
  Student,
} from '../types';
import {
  calculateFeeBalance,
  getFeeStatus,
  calculateDaysOverdue,
  getBillingMonthDateString,
  formatBillingMonth,
} from '../utils/feeUtils';

export interface GetMonthlyFeesOptions {
  batchId?: string;
  status?: FeeStatus;
  search?: string;
}

export async function getMonthlyFees(
  billingMonth: string,
  options?: GetMonthlyFeesOptions
): Promise<{ fees: MonthlyFee[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('monthly_fees')
      .select(`
        id,
        student_id,
        billing_month,
        amount_due,
        due_date,
        created_at,
        updated_at,
        student:students(
          id,
          full_name,
          phone,
          email,
          photo_url,
          guardian_name,
          guardian_phone,
          address,
          enrollment_date,
          batch_id,
          status,
          monthly_fee,
          created_at,
          updated_at,
          batch:batches(id, name, days_of_week, start_time, end_time)
        ),
        payments(id, student_id, monthly_fee_id, amount, payment_date, method, receipt_number, notes, created_at)
      `)
      .eq('billing_month', billingMonth)
      .order('created_at', { ascending: true });

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch monthly fees:', error);
      }
      return { fees: [], error: error.message };
    }

    if (!data) {
      return { fees: [], error: null };
    }

    // Process and enrich fee records with computed properties
    let processedFees: MonthlyFee[] = data.map((row: any) => {
      const studentData = Array.isArray(row.student) ? row.student[0] : row.student;
      const batchData = studentData?.batch
        ? Array.isArray(studentData.batch)
          ? studentData.batch[0]
          : studentData.batch
        : null;

      const student: Student | null = studentData
        ? {
            ...studentData,
            batch: batchData,
          }
        : null;

      const payments: Payment[] = Array.isArray(row.payments) ? row.payments : [];
      const amountPaid = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
      const balance = calculateFeeBalance(row.amount_due, amountPaid);
      const status = getFeeStatus(row.amount_due, amountPaid, row.due_date);
      const daysOverdue = calculateDaysOverdue(row.due_date);

      return {
        id: row.id,
        student_id: row.student_id,
        billing_month: row.billing_month,
        amount_due: row.amount_due,
        due_date: row.due_date,
        created_at: row.created_at,
        updated_at: row.updated_at,
        amount_paid: amountPaid,
        balance,
        status,
        days_overdue: daysOverdue,
        student,
        payments,
      };
    });

    // Apply Filters
    if (options?.batchId && options.batchId !== 'all') {
      processedFees = processedFees.filter((f) => f.student?.batch_id === options.batchId);
    }

    if (options?.status && options.status !== ('all' as any)) {
      processedFees = processedFees.filter((f) => f.status === options.status);
    }

    if (options?.search && options.search.trim()) {
      const query = options.search.trim().toLowerCase();
      processedFees = processedFees.filter((f) => {
        const studentName = f.student?.full_name?.toLowerCase() || '';
        const guardianName = f.student?.guardian_name?.toLowerCase() || '';
        const phone = f.student?.phone || '';
        const guardianPhone = f.student?.guardian_phone || '';
        return (
          studentName.includes(query) ||
          guardianName.includes(query) ||
          phone.includes(query) ||
          guardianPhone.includes(query)
        );
      });
    }

    return { fees: processedFees, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query monthly fees';
    return { fees: [], error: msg };
  }
}

/**
 * Invokes the database function generate_monthly_fees to generate fee records
 * for all active students for a given target month (YYYY-MM-01).
 */
export async function generateMonthlyFees(
  billingMonth: string
): Promise<{ count: number; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('generate_monthly_fees', {
      target_month: billingMonth,
    });

    if (error) {
      if (import.meta.env.DEV) {
        console.error('RPC generate_monthly_fees failed:', error);
      }
      return { count: 0, error: error.message };
    }

    return { count: (data as number) || 0, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate monthly fees';
    return { count: 0, error: msg };
  }
}

/**
 * Fetches all monthly fees across any month that are currently overdue (past due date with remaining balance).
 * Sorted by days overdue descending.
 */
export async function getOverdueFees(): Promise<{ fees: MonthlyFee[]; error: string | null }> {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch monthly fees where due_date < today
    const { data, error } = await supabase
      .from('monthly_fees')
      .select(`
        id,
        student_id,
        billing_month,
        amount_due,
        due_date,
        created_at,
        updated_at,
        student:students(
          id,
          full_name,
          phone,
          email,
          photo_url,
          guardian_name,
          guardian_phone,
          address,
          enrollment_date,
          batch_id,
          status,
          monthly_fee,
          created_at,
          updated_at,
          batch:batches(id, name, days_of_week, start_time, end_time)
        ),
        payments(id, student_id, monthly_fee_id, amount, payment_date, method, receipt_number, notes, created_at)
      `)
      .lt('due_date', todayStr)
      .order('due_date', { ascending: true });

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch overdue fees:', error);
      }
      return { fees: [], error: error.message };
    }

    if (!data) {
      return { fees: [], error: null };
    }

    const overdueList: MonthlyFee[] = [];

    for (const row of data as any[]) {
      const studentData = Array.isArray(row.student) ? row.student[0] : row.student;
      const batchData = studentData?.batch
        ? Array.isArray(studentData.batch)
          ? studentData.batch[0]
          : studentData.batch
        : null;

      const student: Student | null = studentData
        ? {
            ...studentData,
            batch: batchData,
          }
        : null;

      const payments: Payment[] = Array.isArray(row.payments) ? row.payments : [];
      const amountPaid = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
      const balance = calculateFeeBalance(row.amount_due, amountPaid);

      // Only include if there is an unpaid balance
      if (balance > 0) {
        const daysOverdue = calculateDaysOverdue(row.due_date);
        overdueList.push({
          id: row.id,
          student_id: row.student_id,
          billing_month: row.billing_month,
          amount_due: row.amount_due,
          due_date: row.due_date,
          created_at: row.created_at,
          updated_at: row.updated_at,
          amount_paid: amountPaid,
          balance,
          status: 'overdue',
          days_overdue: daysOverdue,
          student,
          payments,
        });
      }
    }

    // Sort by days overdue descending (most overdue first)
    overdueList.sort((a, b) => (b.days_overdue || 0) - (a.days_overdue || 0));

    return { fees: overdueList, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query overdue fees';
    return { fees: [], error: msg };
  }
}

/**
 * Aggregates financial figures for a given billing month.
 */
export async function getMonthlyFinancialSummary(
  billingMonth: string
): Promise<{ summary: MonthlyFinancialSummary | null; error: string | null }> {
  try {
    const { fees, error } = await getMonthlyFees(billingMonth);
    if (error) {
      return { summary: null, error };
    }

    let totalExpected = 0;
    let totalCollected = 0;
    let paidCount = 0;
    let pendingCount = 0;

    for (const fee of fees) {
      totalExpected += fee.amount_due;
      totalCollected += fee.amount_paid || 0;
      if (fee.status === 'paid') {
        paidCount++;
      } else {
        pendingCount++;
      }
    }

    const totalPending = Math.max(0, totalExpected - totalCollected);

    return {
      summary: {
        billing_month: billingMonth,
        total_expected: totalExpected,
        total_collected: totalCollected,
        total_pending: totalPending,
        paid_students_count: paidCount,
        pending_students_count: pendingCount,
      },
      error: null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to calculate monthly financial summary';
    return { summary: null, error: msg };
  }
}

/**
 * Returns data points for the last 12 months for Recharts bar chart & income report.
 */
export async function get12MonthIncomeReport(): Promise<{
  data: MonthlyIncomeDataPoint[];
  error: string | null;
}> {
  try {
    const now = new Date();
    const months: string[] = [];

    // Last 12 months in chronological order
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(getBillingMonthDateString(d));
    }

    const { data: feeRows, error: feeErr } = await supabase
      .from('monthly_fees')
      .select('id, billing_month, amount_due')
      .in('billing_month', months);

    if (feeErr) {
      return { data: [], error: feeErr.message };
    }

    const feeIds = (feeRows || []).map((r) => r.id);
    let paymentsByFeeId: Record<string, number> = {};

    if (feeIds.length > 0) {
      const { data: payRows, error: payErr } = await supabase
        .from('payments')
        .select('monthly_fee_id, amount')
        .in('monthly_fee_id', feeIds);

      if (payErr) {
        return { data: [], error: payErr.message };
      }

      for (const p of payRows || []) {
        paymentsByFeeId[p.monthly_fee_id] = (paymentsByFeeId[p.monthly_fee_id] || 0) + p.amount;
      }
    }

    // Aggregate by month
    const result: MonthlyIncomeDataPoint[] = months.map((mStr) => {
      const matchingFees = (feeRows || []).filter((f) => f.billing_month === mStr);
      let expected = 0;
      let collected = 0;

      for (const f of matchingFees) {
        expected += f.amount_due;
        collected += paymentsByFeeId[f.id] || 0;
      }

      return {
        monthStr: formatBillingMonth(mStr),
        billingMonth: mStr,
        expected,
        collected,
      };
    });

    return { data: result, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query 12-month report';
    return { data: [], error: msg };
  }
}

/**
 * Updates a student's monthly fee setting.
 * If updateCurrentMonth is true, updates this month's monthly_fees.amount_due as well
 * (only if not already paid beyond newFee).
 */
export async function updateStudentMonthlyFee(
  studentId: string,
  newFee: number,
  updateCurrentMonth: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (newFee < 0) {
      return { success: false, error: 'Monthly fee cannot be negative' };
    }

    // 1. Update students table
    const { error: studentErr } = await supabase
      .from('students')
      .update({ monthly_fee: newFee })
      .eq('id', studentId);

    if (studentErr) {
      return { success: false, error: studentErr.message };
    }

    // 2. If updateCurrentMonth is selected, update current month fee record if exists
    if (updateCurrentMonth) {
      const currentMonth = getBillingMonthDateString(new Date());

      // Check current fee record and its payments
      const { data: feeRow, error: feeFindErr } = await supabase
        .from('monthly_fees')
        .select('id, amount_due, payments(amount)')
        .eq('student_id', studentId)
        .eq('billing_month', currentMonth)
        .maybeSingle();

      if (feeFindErr) {
        return { success: false, error: feeFindErr.message };
      }

      if (feeRow) {
        const payments = Array.isArray(feeRow.payments) ? feeRow.payments : [];
        const alreadyPaid = payments.reduce((acc, p: any) => acc + (p.amount || 0), 0);

        if (newFee < alreadyPaid) {
          return {
            success: false,
            error: `Cannot update current month fee to ₹${newFee}: student has already paid ₹${alreadyPaid}.`,
          };
        }

        const { error: feeUpdateErr } = await supabase
          .from('monthly_fees')
          .update({ amount_due: newFee })
          .eq('id', feeRow.id);

        if (feeUpdateErr) {
          return { success: false, error: feeUpdateErr.message };
        }
      }
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update student fee';
    return { success: false, error: msg };
  }
}
