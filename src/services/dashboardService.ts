import { supabase } from '../lib/supabase';

export interface DashboardSummaryRPC {
  active_students: number;
  total_batches: number;
  today_classes_count: number;
  today_cancelled_count: number;
  billed_month: number;
  collected_month: number;
  pending_balance: number;
  attendance_rate: number;
  recent_payments: Array<{
    id: string;
    amount: number;
    payment_date: string;
    receipt_number: string;
    student_name: string;
  }>;
  today_classes: Array<{
    id: string;
    class_date: string;
    start_time: string;
    end_time: string;
    status: string;
    batch_id: string;
    batch_name: string;
  }>;
  today_class_list?: Array<{
    id: string;
    batch_name: string;
    start_time: string;
    end_time: string;
    status: string;
  }>;
  today_cancelled?: number;
}

export async function getDashboardSummaryRPC(): Promise<{
  data: DashboardSummaryRPC | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc('get_dashboard_summary');
    if (error) {
      return { data: null, error: error.message };
    }
    return { data: data as DashboardSummaryRPC, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to call get_dashboard_summary';
    return { data: null, error: msg };
  }
}
