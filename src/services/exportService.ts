import { getStudents } from './studentService';
import { getPaymentHistory } from './paymentService';
import { get12MonthIncomeReport, getOverdueFees } from './feeService';
import { getAcademySettings } from './academyService';
import { getMonthlyAttendanceReport } from './attendanceService';
import { loadImageAsBase64 } from '../utils/receiptPdf';
import {
  exportStudentDirectoryPdf,
  exportStudentDirectoryDocx,
  exportPaymentLedgerPdf,
  exportPaymentLedgerDocx,
  exportBatchAttendancePdf,
  exportBatchAttendanceDocx,
  exportRevenueBreakdownPdf,
  exportRevenueBreakdownDocx,
  exportIncomeStatementPdf,
  exportIncomeStatementDocx,
  exportOutstandingDuesPdf,
  exportOutstandingDuesDocx,
} from '../utils/exportUtils';

export type ExportFormat = 'pdf' | 'docx';

/**
 * 1. Exports Student Directory to PDF or Word (.docx).
 */
export async function exportStudentDirectory(format: ExportFormat): Promise<{ success: boolean; error?: string }> {
  try {
    const [{ students, error: studErr }, { settings }] = await Promise.all([
      getStudents({ status: 'all', batchId: 'all' }),
      getAcademySettings(),
    ]);

    if (studErr) return { success: false, error: studErr };

    let logoBase64: string | null = null;
    if (settings?.logo_url) {
      logoBase64 = await loadImageAsBase64(settings.logo_url);
    }

    if (format === 'pdf') {
      exportStudentDirectoryPdf({
        students,
        academySettings: settings,
        logoBase64,
      });
    } else {
      await exportStudentDirectoryDocx({
        students,
        academySettings: settings,
      });
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to export students';
    return { success: false, error: msg };
  }
}

/**
 * 2. Exports Payment Ledger to PDF or Word (.docx).
 */
export async function exportPaymentLedger(
  params: { startDate?: string; endDate?: string } | undefined,
  format: ExportFormat
): Promise<{ success: boolean; error?: string }> {
  try {
    const [{ payments, error: payErr }, { settings }] = await Promise.all([
      getPaymentHistory({
        startDate: params?.startDate || undefined,
        endDate: params?.endDate || undefined,
      }),
      getAcademySettings(),
    ]);

    if (payErr) return { success: false, error: payErr };

    let logoBase64: string | null = null;
    if (settings?.logo_url) {
      logoBase64 = await loadImageAsBase64(settings.logo_url);
    }

    const rangeLabel =
      params?.startDate && params?.endDate
        ? `${params.startDate}-to-${params.endDate}`
        : 'All';

    if (format === 'pdf') {
      exportPaymentLedgerPdf({
        payments,
        rangeLabel,
        academySettings: settings,
        logoBase64,
      });
    } else {
      await exportPaymentLedgerDocx({
        payments,
        rangeLabel,
        academySettings: settings,
      });
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to export payments';
    return { success: false, error: msg };
  }
}

/**
 * 3. Exports Batch Attendance Report to PDF or Word (.docx).
 */
export async function exportBatchAttendance(
  params: {
    batchId: string;
    batchName: string;
    year: number;
    month: number;
  },
  format: ExportFormat
): Promise<{ success: boolean; error?: string }> {
  try {
    const { batchId, batchName, year, month } = params;

    const [{ report, error: reportErr }, { settings }] = await Promise.all([
      getMonthlyAttendanceReport(batchId, year, month),
      getAcademySettings(),
    ]);

    if (reportErr) return { success: false, error: reportErr };

    let logoBase64: string | null = null;
    if (settings?.logo_url) {
      logoBase64 = await loadImageAsBase64(settings.logo_url);
    }

    if (format === 'pdf') {
      exportBatchAttendancePdf({
        batchName,
        year,
        month,
        records: report,
        academySettings: settings,
        logoBase64,
      });
    } else {
      await exportBatchAttendanceDocx({
        batchName,
        year,
        month,
        records: report,
        academySettings: settings,
      });
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to export attendance report';
    return { success: false, error: msg };
  }
}

/**
 * 4. Exports 12-Month Revenue Breakdown to PDF or Word (.docx).
 */
export async function exportRevenueBreakdown(
  year: number,
  format: ExportFormat
): Promise<{ success: boolean; error?: string }> {
  try {
    const [{ data, error: incomeErr }, { settings }] = await Promise.all([
      get12MonthIncomeReport(),
      getAcademySettings(),
    ]);

    if (incomeErr) return { success: false, error: incomeErr };

    let logoBase64: string | null = null;
    if (settings?.logo_url) {
      logoBase64 = await loadImageAsBase64(settings.logo_url);
    }

    if (format === 'pdf') {
      exportRevenueBreakdownPdf({
        data,
        year,
        academySettings: settings,
        logoBase64,
      });
    } else {
      await exportRevenueBreakdownDocx({
        data,
        year,
        academySettings: settings,
      });
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to export revenue breakdown';
    return { success: false, error: msg };
  }
}

/**
 * 5. Exports 12-Month Income Statement to PDF or Word (.docx).
 */
export async function exportIncomeStatement(format: ExportFormat): Promise<{ success: boolean; error?: string }> {
  try {
    const [{ data, error: incomeErr }, { settings }] = await Promise.all([
      get12MonthIncomeReport(),
      getAcademySettings(),
    ]);

    if (incomeErr) return { success: false, error: incomeErr };

    let logoBase64: string | null = null;
    if (settings?.logo_url) {
      logoBase64 = await loadImageAsBase64(settings.logo_url);
    }

    if (format === 'pdf') {
      exportIncomeStatementPdf({
        data,
        academySettings: settings,
        logoBase64,
      });
    } else {
      await exportIncomeStatementDocx({
        data,
        academySettings: settings,
      });
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to export income statement';
    return { success: false, error: msg };
  }
}

/**
 * 6. Exports Outstanding Student Dues to PDF or Word (.docx).
 */
export async function exportOutstandingDues(format: ExportFormat): Promise<{ success: boolean; error?: string }> {
  try {
    const [{ fees, error: overdueErr }, { settings }] = await Promise.all([
      getOverdueFees(),
      getAcademySettings(),
    ]);

    if (overdueErr) return { success: false, error: overdueErr };

    let logoBase64: string | null = null;
    if (settings?.logo_url) {
      logoBase64 = await loadImageAsBase64(settings.logo_url);
    }

    if (format === 'pdf') {
      exportOutstandingDuesPdf({
        overdueFees: fees,
        academySettings: settings,
        logoBase64,
      });
    } else {
      await exportOutstandingDuesDocx({
        overdueFees: fees,
        academySettings: settings,
      });
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to export outstanding dues';
    return { success: false, error: msg };
  }
}
