import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateBackupPayload,
  formatBackupFilename,
  formatSingleTableFilename,
  isBackupOlderThanDays,
  saveLastBackupDate,
  clearLastBackupDate,
} from './backupUtils';

describe('backupUtils', () => {
  const validSampleBackup = {
    metadata: {
      version: '1.0.0',
      appName: 'MIX with Me Classes',
      exportDate: '2026-11-18T10:00:00.000Z',
      tables: {
        academy_settings: 1,
        batches: 2,
        students: 2,
        classes: 1,
        monthly_fees: 1,
        attendance: 1,
        payments: 1,
      },
    },
    tables: {
      academy_settings: [{ id: 'set-1', academy_name: 'MIX with Me Classes' }],
      batches: [
        { id: 'b-1', name: 'Guitar Beginners' },
        { id: 'b-2', name: 'Piano Juniors' },
      ],
      students: [
        { id: 's-1', full_name: 'John Doe' },
        { id: 's-2', full_name: 'Jane Smith' },
      ],
      classes: [{ id: 'c-1', batch_id: 'b-1' }],
      monthly_fees: [{ id: 'f-1', student_id: 's-1' }],
      attendance: [{ id: 'a-1', class_id: 'c-1', student_id: 's-1' }],
      payments: [{ id: 'p-1', student_id: 's-1', amount: 1500 }],
    },
  };

  describe('validateBackupPayload', () => {
    it('accepts a fully valid backup payload and computes preview correctly', () => {
      const result = validateBackupPayload(validSampleBackup);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.preview).toBeDefined();
      expect(result.preview?.version).toBe('1.0.0');
      expect(result.preview?.appName).toBe('MIX with Me Classes');
      expect(result.preview?.totalRecords).toBe(9);
      expect(result.preview?.tableCounts.students).toBe(2);
    });

    it('rejects null or non-object payloads', () => {
      expect(validateBackupPayload(null).isValid).toBe(false);
      expect(validateBackupPayload('string').isValid).toBe(false);
      expect(validateBackupPayload([]).isValid).toBe(false);
    });

    it('rejects payload missing metadata', () => {
      const invalid = { tables: validSampleBackup.tables };
      const res = validateBackupPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('metadata');
    });

    it('rejects payload with foreign appName in metadata', () => {
      const foreignApp = {
        ...validSampleBackup,
        metadata: {
          ...validSampleBackup.metadata,
          appName: 'Some Other Academy Software',
        },
      };
      const res = validateBackupPayload(foreignApp);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('MIX with Me Classes');
    });

    it('rejects payload missing required tables', () => {
      const missingTable = {
        metadata: validSampleBackup.metadata,
        tables: {
          academy_settings: [],
          batches: [],
          // missing students
          classes: [],
          monthly_fees: [],
          attendance: [],
          payments: [],
        },
      };
      const res = validateBackupPayload(missingTable);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('students');
    });

    it('rejects payload where table records are not objects with primary keys', () => {
      const malformedRecords = {
        ...validSampleBackup,
        tables: {
          ...validSampleBackup.tables,
          students: ['not-an-object'],
        },
      };
      const res = validateBackupPayload(malformedRecords);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('non-object');
    });

    it('rejects payload where rows lack an id field', () => {
      const missingId = {
        ...validSampleBackup,
        tables: {
          ...validSampleBackup.tables,
          students: [{ name: 'No ID here' }],
        },
      };
      const res = validateBackupPayload(missingId);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('primary key "id"');
    });
  });

  describe('filename formatters', () => {
    it('formats full backup filename with correct prefix and date', () => {
      const date = new Date(2026, 10, 18); // Nov 18, 2026
      expect(formatBackupFilename(date)).toBe('MIX-with-Me-backup-2026-11-18.json');
    });

    it('formats single table filename with table name and date', () => {
      const date = new Date(2026, 10, 18);
      expect(formatSingleTableFilename('students', date)).toBe('MIX-with-Me-students-2026-11-18.json');
    });
  });

  describe('isBackupOlderThanDays', () => {
    beforeEach(() => {
      clearLastBackupDate();
    });

    it('returns true if no backup date has ever been saved', () => {
      expect(isBackupOlderThanDays(14)).toBe(true);
    });

    it('returns false if backup was saved recently (e.g. today)', () => {
      const now = new Date(2026, 10, 18, 12, 0, 0);
      saveLastBackupDate(now);

      const checkDate = new Date(2026, 10, 18, 14, 0, 0); // 2 hours later
      expect(isBackupOlderThanDays(14, checkDate)).toBe(false);
    });

    it('returns true if backup was saved more than 14 days ago', () => {
      const oldDate = new Date(2026, 9, 1); // 1 Oct 2026
      saveLastBackupDate(oldDate);

      const checkDate = new Date(2026, 10, 18); // 18 Nov 2026 (> 40 days)
      expect(isBackupOlderThanDays(14, checkDate)).toBe(true);
    });
  });
});
