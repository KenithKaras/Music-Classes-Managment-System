import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SchemaValidationResult {
  isValid: boolean;
  missingTables: string[];
  missingColumns: Array<{ table: string; column: string }>;
  errors: string[];
}

const REQUIRED_TABLE_COLUMNS: Record<string, string[]> = {
  academy_settings: ['id', 'academy_name', 'owner_id'],
  batches: ['id', 'name', 'days_of_week', 'start_time', 'end_time', 'owner_id'],
  students: ['id', 'full_name', 'monthly_fee', 'status', 'owner_id'],
  classes: ['id', 'batch_id', 'class_date', 'start_time', 'end_time', 'status', 'owner_id'],
  attendance: ['id', 'class_id', 'student_id', 'status', 'marked_at', 'owner_id'],
  monthly_fees: ['id', 'student_id', 'billing_month', 'amount_due', 'owner_id'],
  payments: ['id', 'student_id', 'monthly_fee_id', 'amount', 'payment_date', 'receipt_number', 'owner_id'],
  profiles: ['id', 'full_name'],
};

/**
 * Validates that migrations 001 to 008 (and required tables/columns) have executed.
 * In development, this quickly checks table and column accessibility via PostgREST limit(0).
 */
export async function validateDatabaseSchema(): Promise<SchemaValidationResult> {
  const result: SchemaValidationResult = {
    isValid: true,
    missingTables: [],
    missingColumns: [],
    errors: [],
  };

  if (!isSupabaseConfigured) {
    return result; // Handled by missing environment variables screen
  }

  for (const [table, columns] of Object.entries(REQUIRED_TABLE_COLUMNS)) {
    // 1. Verify table exists
    const tableCheck = await supabase.from(table).select('id').limit(0);
    if (tableCheck.error) {
      // 42P01: undefined_table
      if (
        tableCheck.error.code === '42P01' ||
        tableCheck.error.message.toLowerCase().includes('does not exist') ||
        tableCheck.error.message.toLowerCase().includes('relation')
      ) {
        result.missingTables.push(table);
        result.isValid = false;
        continue;
      }
    }

    // 2. Verify expected columns
    for (const col of columns) {
      const colCheck = await supabase.from(table).select(col).limit(0);
      if (colCheck.error) {
        if (
          colCheck.error.code === '42703' ||
          colCheck.error.message.toLowerCase().includes('does not exist')
        ) {
          result.missingColumns.push({ table, column: col });
          result.isValid = false;
        }
      }
    }
  }

  return result;
}
