import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Users,
  CreditCard,
  ClipboardCheck,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { SettingsSubNav } from '../components/SettingsSubNav';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { getBatches } from '../services/batchService';
import {
  exportStudentDirectory,
  exportPaymentLedger,
  exportBatchAttendance,
  exportRevenueBreakdown,
  exportIncomeStatement,
  exportOutstandingDues,
} from '../services/exportService';
import type { Batch } from '../types';

export const ExportsPage: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);

  // Filters
  const [paymentStartDate, setPaymentStartDate] = useState('');
  const [paymentEndDate, setPaymentEndDate] = useState('');

  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [attendanceYear, setAttendanceYear] = useState<number>(() => new Date().getFullYear());
  const [attendanceMonth, setAttendanceMonth] = useState<number>(() => new Date().getMonth() + 1);

  const [revenueYear, setRevenueYear] = useState<number>(() => new Date().getFullYear());

  // Loading states
  const [activeExport, setActiveExport] = useState<string | null>(null);

  // Feedback states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    getBatches().then(({ batches: list }) => {
      setBatches(list);
      if (list.length > 0) {
        setSelectedBatchId(list[0].id);
      }
    });
  }, []);

  const runExport = async (key: string, fn: () => Promise<{ success: boolean; error?: string }>, label: string) => {
    setActiveExport(key);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fn();
      if (!res.success) {
        setErrorMsg(res.error || `Failed to generate ${label}.`);
      } else {
        setSuccessMsg(`${label} generated and downloaded successfully!`);
      }
    } finally {
      setActiveExport(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
          <FileText className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          Settings, Backups &amp; Exports
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Export academy reports and financial statements in PDF (.pdf) and Word (.docx) formats.
        </p>
      </div>

      {/* Sub Navigation */}
      <SettingsSubNav />

      {/* Feedback Banners */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800"
          >
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60 text-red-800 dark:text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="font-bold text-red-600 dark:text-rose-400 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Report Cards Grid */}
      <div className="space-y-5">
        {/* 1. Student Directory */}
        <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Student Directory</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete student roster including active/inactive status, batch assignments, contact details, and assigned monthly fees.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={activeExport === 'students-pdf'}
              disabled={activeExport !== null}
              onClick={() => runExport('students-pdf', () => exportStudentDirectory('pdf'), 'Student Directory PDF')}
              icon={Download}
              className="w-full sm:w-auto"
            >
              Download PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={activeExport === 'students-docx'}
              disabled={activeExport !== null}
              onClick={() => runExport('students-docx', () => exportStudentDirectory('docx'), 'Student Directory Word')}
              icon={Download}
              className="w-full sm:w-auto"
            >
              Download Word
            </Button>
          </div>
        </div>

        {/* 2. Payment Ledger */}
        <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Payment Ledger</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detailed transaction log with receipt numbers, student names, billing months, payment modes, and totals.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={activeExport === 'payments-pdf'}
                disabled={activeExport !== null}
                onClick={() =>
                  runExport(
                    'payments-pdf',
                    () => exportPaymentLedger({ startDate: paymentStartDate, endDate: paymentEndDate }, 'pdf'),
                    'Payment Ledger PDF'
                  )
                }
                icon={Download}
                className="w-full sm:w-auto"
              >
                Download PDF
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={activeExport === 'payments-docx'}
                disabled={activeExport !== null}
                onClick={() =>
                  runExport(
                    'payments-docx',
                    () => exportPaymentLedger({ startDate: paymentStartDate, endDate: paymentEndDate }, 'docx'),
                    'Payment Ledger Word'
                  )
                }
                icon={Download}
                className="w-full sm:w-auto"
              >
                Download Word
              </Button>
            </div>
          </div>

          {/* Date range filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Input
              type="date"
              label="Start Date (Optional)"
              value={paymentStartDate}
              onChange={(e) => setPaymentStartDate(e.target.value)}
              className="text-xs"
            />
            <Input
              type="date"
              label="End Date (Optional)"
              value={paymentEndDate}
              onChange={(e) => setPaymentEndDate(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        {/* 3. Batch Attendance Report */}
        <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Batch Attendance Report</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monthly student attendance summary with classes held, present, absent, and attendance rate percentages.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={activeExport === 'attendance-pdf'}
                disabled={activeExport !== null || !selectedBatchId}
                onClick={() => {
                  const b = batches.find((x) => x.id === selectedBatchId);
                  const name = b ? b.name : 'Batch';
                  runExport(
                    'attendance-pdf',
                    () =>
                      exportBatchAttendance(
                        { batchId: selectedBatchId, batchName: name, year: attendanceYear, month: attendanceMonth },
                        'pdf'
                      ),
                    'Attendance Report PDF'
                  );
                }}
                icon={Download}
                className="w-full sm:w-auto"
              >
                Download PDF
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={activeExport === 'attendance-docx'}
                disabled={activeExport !== null || !selectedBatchId}
                onClick={() => {
                  const b = batches.find((x) => x.id === selectedBatchId);
                  const name = b ? b.name : 'Batch';
                  runExport(
                    'attendance-docx',
                    () =>
                      exportBatchAttendance(
                        { batchId: selectedBatchId, batchName: name, year: attendanceYear, month: attendanceMonth },
                        'docx'
                      ),
                    'Attendance Report Word'
                  );
                }}
                icon={Download}
                className="w-full sm:w-auto"
              >
                Download Word
              </Button>
            </div>
          </div>

          {/* Batch & Month Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Select
              label="Select Batch"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              options={batches.map((b) => ({ value: b.id, label: b.name }))}
            />
            <Select
              label="Month"
              value={String(attendanceMonth)}
              onChange={(e) => setAttendanceMonth(parseInt(e.target.value, 10))}
              options={[
                { value: '1', label: 'January' },
                { value: '2', label: 'February' },
                { value: '3', label: 'March' },
                { value: '4', label: 'April' },
                { value: '5', label: 'May' },
                { value: '6', label: 'June' },
                { value: '7', label: 'July' },
                { value: '8', label: 'August' },
                { value: '9', label: 'September' },
                { value: '10', label: 'October' },
                { value: '11', label: 'November' },
                { value: '12', label: 'December' },
              ]}
            />
            <Select
              label="Year"
              value={String(attendanceYear)}
              onChange={(e) => setAttendanceYear(parseInt(e.target.value, 10))}
              options={[2024, 2025, 2026, 2027].map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
        </div>

        {/* 4. 12-Month Revenue Breakdown */}
        <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">12-Month Revenue Breakdown</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Annual financial breakdown comparing expected tuition revenue, actual collections, pending balances, and collection rates.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={activeExport === 'revenue-pdf'}
                disabled={activeExport !== null}
                onClick={() =>
                  runExport(
                    'revenue-pdf',
                    () => exportRevenueBreakdown(revenueYear, 'pdf'),
                    'Revenue Breakdown PDF'
                  )
                }
                icon={Download}
                className="w-full sm:w-auto"
              >
                Download PDF
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={activeExport === 'revenue-docx'}
                disabled={activeExport !== null}
                onClick={() =>
                  runExport(
                    'revenue-docx',
                    () => exportRevenueBreakdown(revenueYear, 'docx'),
                    'Revenue Breakdown Word'
                  )
                }
                icon={Download}
                className="w-full sm:w-auto"
              >
                Download Word
              </Button>
            </div>
          </div>

          <div className="sm:w-48 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Select
              label="Select Year"
              value={String(revenueYear)}
              onChange={(e) => setRevenueYear(parseInt(e.target.value, 10))}
              options={[2024, 2025, 2026, 2027].map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
        </div>

        {/* 5. 12-Month Income Statement */}
        <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">12-Month Income Statement</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Executive income report for the trailing 12-month period with billed tuition, realized cash flows, and overall totals.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={activeExport === 'income-pdf'}
              disabled={activeExport !== null}
              onClick={() => runExport('income-pdf', () => exportIncomeStatement('pdf'), 'Income Statement PDF')}
              icon={Download}
            >
              Download PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={activeExport === 'income-docx'}
              disabled={activeExport !== null}
              onClick={() => runExport('income-docx', () => exportIncomeStatement('docx'), 'Income Statement Word')}
              icon={Download}
            >
              Download Word
            </Button>
          </div>
        </div>

        {/* 6. Outstanding Student Dues */}
        <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Outstanding Student Dues</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit report of all students with pending or overdue tuition fees, due dates, partial payments, and balances.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={activeExport === 'dues-pdf'}
              disabled={activeExport !== null}
              onClick={() => runExport('dues-pdf', () => exportOutstandingDues('pdf'), 'Outstanding Dues PDF')}
              icon={Download}
            >
              Download PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={activeExport === 'dues-docx'}
              disabled={activeExport !== null}
              onClick={() => runExport('dues-docx', () => exportOutstandingDues('docx'), 'Outstanding Dues Word')}
              icon={Download}
            >
              Download Word
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
