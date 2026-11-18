import { supabase } from '../lib/supabase';
import type { BackupPayload } from '../types';
import {
  BACKUP_VERSION,
  APP_NAME,
  formatBackupFilename,
  formatSingleTableFilename,
  saveLastBackupDate,
} from '../utils/backupUtils';

/**
 * Convenience helper to trigger a browser file download of JSON content.
 */
function downloadJsonFile(data: unknown, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 1. Creates and downloads a complete database backup JSON file containing all 7 tables.
 * Stores last backup timestamp in localStorage.
 */
export async function downloadFullDatabaseBackup(): Promise<{
  success: boolean;
  filename?: string;
  error?: string;
}> {
  try {
    const [
      settingsRes,
      batchesRes,
      studentsRes,
      classesRes,
      feesRes,
      attendanceRes,
      paymentsRes,
    ] = await Promise.all([
      supabase.from('academy_settings').select('*'),
      supabase.from('batches').select('*').order('created_at', { ascending: true }),
      supabase.from('students').select('*').order('created_at', { ascending: true }),
      supabase.from('classes').select('*').order('class_date', { ascending: true }),
      supabase.from('monthly_fees').select('*').order('billing_month', { ascending: true }),
      supabase.from('attendance').select('*').order('marked_at', { ascending: true }),
      supabase.from('payments').select('*').order('payment_date', { ascending: true }),
    ]);

    // Check for any query errors
    const errors = [
      settingsRes.error,
      batchesRes.error,
      studentsRes.error,
      classesRes.error,
      feesRes.error,
      attendanceRes.error,
      paymentsRes.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      return { success: false, error: errors[0]?.message || 'Failed to export table data' };
    }

    const tablesData = {
      academy_settings: settingsRes.data || [],
      batches: batchesRes.data || [],
      students: studentsRes.data || [],
      classes: classesRes.data || [],
      monthly_fees: feesRes.data || [],
      attendance: attendanceRes.data || [],
      payments: paymentsRes.data || [],
    };

    const payload: BackupPayload = {
      metadata: {
        version: BACKUP_VERSION,
        appName: APP_NAME,
        exportDate: new Date().toISOString(),
        tables: {
          academy_settings: tablesData.academy_settings.length,
          batches: tablesData.batches.length,
          students: tablesData.students.length,
          classes: tablesData.classes.length,
          monthly_fees: tablesData.monthly_fees.length,
          attendance: tablesData.attendance.length,
          payments: tablesData.payments.length,
        },
      },
      tables: tablesData,
    };

    const filename = formatBackupFilename(new Date());
    downloadJsonFile(payload, filename);
    saveLastBackupDate(new Date());

    return { success: true, filename };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unexpected error generating backup';
    return { success: false, error: msg };
  }
}

/**
 * 2. Creates and downloads a single table JSON backup (students, attendance, or payments).
 */
export async function downloadSingleTableBackup(
  tableName: 'students' | 'attendance' | 'payments'
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    const sortColumn =
      tableName === 'attendance'
        ? 'marked_at'
        : tableName === 'payments'
        ? 'payment_date'
        : 'created_at';

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(sortColumn, { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const payload = {
      metadata: {
        version: BACKUP_VERSION,
        appName: APP_NAME,
        exportDate: new Date().toISOString(),
        table: tableName,
        rowCount: (data || []).length,
      },
      data: data || [],
    };

    const filename = formatSingleTableFilename(tableName, new Date());
    downloadJsonFile(payload, filename);

    return { success: true, filename };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unexpected error exporting table';
    return { success: false, error: msg };
  }
}

/**
 * 4. Atomically restores the database from a validated backup payload
 * through the single transactional RPC function "restore_database_backup".
 */
export async function restoreDatabase(backupPayload: BackupPayload): Promise<{
  success: boolean;
  restoredCounts?: Record<string, number>;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('restore_database_backup', {
      backup_payload: backupPayload,
    });

    if (error) {
      if (import.meta.env.DEV) {
        console.error('RPC restore_database_backup failed:', error);
      }
      return { success: false, error: error.message };
    }

    if (data && data.success) {
      return {
        success: true,
        restoredCounts: data.restored_counts,
      };
    }

    return { success: false, error: 'Database restore failed to confirm success.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unexpected error during restore';
    return { success: false, error: msg };
  }
}
