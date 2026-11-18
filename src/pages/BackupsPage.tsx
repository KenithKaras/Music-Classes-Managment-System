import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { SettingsSubNav } from '../components/SettingsSubNav';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import {
  downloadFullDatabaseBackup,
  restoreDatabase,
} from '../services/backupService';
import {
  validateBackupPayload,
  getLastBackupDate,
} from '../utils/backupUtils';
import type { BackupPayload, BackupPreview } from '../types';

export const BackupsPage: React.FC = () => {
  // Download states
  const [isDownloadingFull, setIsDownloadingFull] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);

  // Restore states
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [validatedBackup, setValidatedBackup] = useState<BackupPayload | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<Record<string, number> | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    refreshLastBackupTime();
  }, []);

  const refreshLastBackupTime = () => {
    const raw = getLastBackupDate();
    if (raw) {
      try {
        const d = new Date(raw);
        setLastBackupDate(
          d.toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        );
      } catch {
        setLastBackupDate(raw);
      }
    } else {
      setLastBackupDate(null);
    }
  };

  const handleFullBackupDownload = async () => {
    setIsDownloadingFull(true);
    try {
      await downloadFullDatabaseBackup();
      refreshLastBackupTime();
    } finally {
      setIsDownloadingFull(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    setValidatedBackup(null);
    setBackupPreview(null);
    setRestoreSuccess(null);
    setRestoreError(null);
    setRestoreConfirmText('');

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setValidationError('Please select a valid .json backup file.');
      return;
    }

    setUploadedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const result = validateBackupPayload(parsed);

        if (!result.isValid || !result.preview || !result.validatedPayload) {
          setValidationError(result.error || 'Backup file failed validation check.');
        } else {
          setBackupPreview(result.preview);
          setValidatedBackup(result.validatedPayload);
        }
      } catch {
        setValidationError('Invalid JSON syntax. The file could not be parsed.');
      }
    };
    reader.onerror = () => {
      setValidationError('Error reading file from disk.');
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!validatedBackup || restoreConfirmText.trim() !== 'RESTORE') return;

    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(null);

    try {
      const result = await restoreDatabase(validatedBackup);
      if (!result.success || result.error) {
        setRestoreError(result.error || 'Database restore failed.');
      } else {
        setRestoreSuccess(result.restoredCounts || {});
        setValidatedBackup(null);
        setBackupPreview(null);
        setUploadedFile(null);
        setRestoreConfirmText('');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
          <Database className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          Settings, Backups &amp; Exports
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Export full database backups or restore from a previous JSON backup file.
        </p>
      </div>

      {/* Sub Navigation */}
      <SettingsSubNav />

      {/* 1. Full Database Backup Card */}
      <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Full Database Backup
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Backup file (JSON, for restore only). Exports a complete file containing settings, batches, students, timetable, attendance, monthly fees, and payments.
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={handleFullBackupDownload}
            loading={isDownloadingFull}
            icon={Download}
            className="w-full sm:w-auto shrink-0"
          >
            Download Backup file (JSON, for restore only)
          </Button>
        </div>

        {/* Last backup indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>
            Last backup downloaded:{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {lastBackupDate || 'Never downloaded on this device'}
            </strong>
          </span>
        </div>
      </div>

      {/* 2. Restore Database from Backup Card */}
      <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-6 shadow-xs space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Restore Database from Backup
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Upload a previously exported JSON backup file to restore academy records.
          </p>
        </div>

        {/* Restore Success Banner */}
        {restoreSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Database Successfully Restored!</span>
            </div>
            <p>
              All records were restored inside an atomic PostgreSQL transaction. Here is the restored summary:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
              {Object.entries(restoreSuccess).map(([table, count]) => (
                <div key={table} className="bg-white/70 p-2 rounded-lg border border-emerald-200">
                  <span className="text-slate-500 block text-xs">{table}</span>
                  <span className="font-bold text-emerald-800 text-sm">{count} rows</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Restore Error Banner */}
        {restoreError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Restore Failed &amp; Rolled Back</p>
              <p className="mt-1">{restoreError}</p>
              <p className="mt-1 text-slate-600">
                Because of transactional safety, no existing records were modified.
              </p>
            </div>
          </div>
        )}

        {/* File Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Select JSON Backup File
          </label>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            disabled={isRestoring}
            className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-300 rounded-xl p-1 bg-slate-50"
          />
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Validated Backup Preview & Confirmation */}
        {backupPreview && (
          <div className="space-y-4 pt-2 border-t border-slate-100">
            {/* Warning Banner */}
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Warning: This Action Replaces Existing Data</p>
                <p className="mt-1">
                  Restoring will delete all current records and restore exactly what is in this backup file.
                  If any row fails to restore, the transaction will automatically roll back with zero changes.
                </p>
              </div>
            </div>

            {/* Preview Breakdown Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="bg-slate-50 px-4 py-2.5 font-semibold text-slate-700 flex flex-col sm:flex-row sm:justify-between gap-1 border-b border-slate-200">
                <span>
                  Backup Preview:{' '}
                  <span className="font-mono text-slate-900 font-normal">
                    {uploadedFile?.name}
                  </span>
                </span>
                <span className="font-mono text-indigo-700 font-normal">
                  Exported on {new Date(backupPreview.exportDate).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {Object.entries(backupPreview.tableCounts).map(([tbl, count]) => (
                  <div key={tbl} className="px-4 py-2 flex justify-between items-center">
                    <span className="font-mono text-slate-600">{tbl}</span>
                    <span className="font-semibold text-slate-900">{count} records</span>
                  </div>
                ))}
                <div className="px-4 py-2.5 bg-slate-50/50 flex justify-between items-center font-bold text-slate-900">
                  <span>Total Records to Restore</span>
                  <span>{backupPreview.totalRecords}</span>
                </div>
              </div>
            </div>

            {/* Type RESTORE to confirm */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700">
                To confirm and unlock restore, please type <span className="font-mono font-bold text-red-600">RESTORE</span> below:
              </label>
              <Input
                type="text"
                placeholder="Type RESTORE"
                value={restoreConfirmText}
                onChange={(e) => setRestoreConfirmText(e.target.value)}
                disabled={isRestoring}
              />

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleExecuteRestore}
                  disabled={restoreConfirmText.trim() !== 'RESTORE' || isRestoring}
                  loading={isRestoring}
                  icon={ShieldAlert}
                >
                  Confirm &amp; Restore Database
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
