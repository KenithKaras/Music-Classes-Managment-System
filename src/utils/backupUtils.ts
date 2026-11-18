import type { BackupPayload, BackupPreview } from '../types';

export const BACKUP_VERSION = '1.0.0';
export const APP_NAME = 'MIX with Me Classes';
export const REQUIRED_BACKUP_TABLES = [
  'academy_settings',
  'batches',
  'students',
  'classes',
  'monthly_fees',
  'attendance',
  'payments',
] as const;

export const LAST_BACKUP_STORAGE_KEY = 'mix_with_me_last_backup_date';

// In-memory fallback for environments without localStorage (e.g. test environments)
let memoryStore: Record<string, string> = {};

export interface BackupValidationResult {
  isValid: boolean;
  error?: string;
  preview?: BackupPreview;
  validatedPayload?: BackupPayload;
}

/**
 * Validates a parsed JSON backup payload to ensure metadata and all required
 * table arrays are present and structurally sound.
 */
export function validateBackupPayload(payload: unknown): BackupValidationResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { isValid: false, error: 'Invalid backup file: Root must be a valid JSON object.' };
  }

  const obj = payload as Record<string, any>;

  // 1. Validate Metadata
  if (!obj.metadata || typeof obj.metadata !== 'object' || Array.isArray(obj.metadata)) {
    return { isValid: false, error: 'Missing or invalid "metadata" header in backup file.' };
  }

  const { version, appName, exportDate } = obj.metadata;

  if (!version || typeof version !== 'string') {
    return { isValid: false, error: 'Backup metadata is missing a valid "version" string.' };
  }

  if (!appName || typeof appName !== 'string' || !appName.includes('MIX with Me')) {
    return {
      isValid: false,
      error: 'Backup file does not match "MIX with Me Classes" application signature.',
    };
  }

  if (!exportDate || typeof exportDate !== 'string' || isNaN(Date.parse(exportDate))) {
    return { isValid: false, error: 'Backup metadata contains an invalid or missing "exportDate".' };
  }

  // 2. Validate Tables
  if (!obj.tables || typeof obj.tables !== 'object' || Array.isArray(obj.tables)) {
    return { isValid: false, error: 'Missing or invalid "tables" dictionary in backup file.' };
  }

  const tableCounts: Record<string, number> = {};
  let totalRecords = 0;

  for (const tableName of REQUIRED_BACKUP_TABLES) {
    if (!(tableName in obj.tables)) {
      return {
        isValid: false,
        error: `Backup is missing required database table: "${tableName}".`,
      };
    }

    const tableRows = obj.tables[tableName];
    if (!Array.isArray(tableRows)) {
      return {
        isValid: false,
        error: `Table "${tableName}" must be an array of records.`,
      };
    }

    // Verify item row shape if non-empty
    if (tableRows.length > 0) {
      const firstRow = tableRows[0];
      if (!firstRow || typeof firstRow !== 'object' || Array.isArray(firstRow)) {
        return {
          isValid: false,
          error: `Table "${tableName}" contains invalid non-object records.`,
        };
      }
      if (!('id' in firstRow)) {
        return {
          isValid: false,
          error: `Table "${tableName}" records are missing primary key "id".`,
        };
      }
    }

    tableCounts[tableName] = tableRows.length;
    totalRecords += tableRows.length;
  }

  const preview: BackupPreview = {
    version,
    appName,
    exportDate,
    tableCounts,
    totalRecords,
  };

  return {
    isValid: true,
    preview,
    validatedPayload: obj as BackupPayload,
  };
}

/**
 * Formats full backup download filename: MIX-with-Me-backup-YYYY-MM-DD.json
 */
export function formatBackupFilename(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `MIX-with-Me-backup-${yyyy}-${mm}-${dd}.json`;
}

/**
 * Formats single table export filename: MIX-with-Me-[tableName]-YYYY-MM-DD.json
 */
export function formatSingleTableFilename(tableName: string, date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `MIX-with-Me-${tableName}-${yyyy}-${mm}-${dd}.json`;
}

/**
 * Saves the last backup download timestamp to localStorage safely.
 */
export function saveLastBackupDate(date: Date = new Date()): boolean {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(LAST_BACKUP_STORAGE_KEY, date.toISOString());
    } else {
      memoryStore[LAST_BACKUP_STORAGE_KEY] = date.toISOString();
    }
    return true;
  } catch {
    memoryStore[LAST_BACKUP_STORAGE_KEY] = date.toISOString();
    return true;
  }
}

/**
 * Retrieves the last backup download ISO timestamp from localStorage safely.
 */
export function getLastBackupDate(): string | null {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const val = localStorage.getItem(LAST_BACKUP_STORAGE_KEY);
      if (val) return val;
    }
    return memoryStore[LAST_BACKUP_STORAGE_KEY] || null;
  } catch {
    return memoryStore[LAST_BACKUP_STORAGE_KEY] || null;
  }
}

/**
 * Clears stored backup timestamp (useful for testing).
 */
export function clearLastBackupDate(): void {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
      localStorage.removeItem(LAST_BACKUP_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
  memoryStore = {};
}

/**
 * Checks if the last backup is older than a specified number of days (default 14 days)
 * or if no backup has ever been recorded.
 */
export function isBackupOlderThanDays(days = 14, asOfDate: Date = new Date()): boolean {
  const lastDateStr = getLastBackupDate();
  if (!lastDateStr) {
    return true;
  }

  const lastDate = new Date(lastDateStr);
  if (isNaN(lastDate.getTime())) {
    return true;
  }

  const diffMs = asOfDate.getTime() - lastDate.getTime();
  const thresholdMs = days * 24 * 60 * 60 * 1000;

  return diffMs > thresholdMs;
}
