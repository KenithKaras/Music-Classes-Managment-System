import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} from 'docx';
import type {
  Student,
  Payment,
  MonthlyIncomeDataPoint,
  AcademySettings,
  MonthlyFee,
  MonthlyIncomeExportRow,
  StudentMonthlyAttendance,
} from '../types';
import { formatIndianCurrency, formatBillingMonth } from './feeUtils';
import { formatDisplayDate } from './formUtils';

// ==============================================================================
// 1. PURE CALCULATION FUNCTIONS (Unit-tested against on-screen dashboard/tables)
// ==============================================================================

export interface IncomeSummaryResult {
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  overallRate: number;
  rows: MonthlyIncomeExportRow[];
}

export function calculateIncomeSummary(data: MonthlyIncomeDataPoint[]): IncomeSummaryResult {
  let totalExpected = 0;
  let totalCollected = 0;

  const rows: MonthlyIncomeExportRow[] = data.map((item) => {
    const expected = Math.max(0, Math.round(item.expected || 0));
    const collected = Math.max(0, Math.round(item.collected || 0));
    const pending = Math.max(0, expected - collected);
    const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;

    totalExpected += expected;
    totalCollected += collected;

    return {
      'Billing Month': item.billingMonth,
      'Month': item.monthStr,
      'Expected Revenue (₹)': expected,
      'Collected Revenue (₹)': collected,
      'Pending Dues (₹)': pending,
      'Collection Rate (%)': rate,
    };
  });

  const totalPending = Math.max(0, totalExpected - totalCollected);
  const overallRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  return {
    totalExpected,
    totalCollected,
    totalPending,
    overallRate,
    rows,
  };
}

export interface StudentSummaryResult {
  totalStudents: number;
  activeStudents: number;
  inactiveStudents: number;
  totalMonthlyRevenue: number;
}

export function calculateStudentSummary(students: Student[]): StudentSummaryResult {
  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.status === 'active').length;
  const inactiveStudents = totalStudents - activeStudents;
  const totalMonthlyRevenue = students
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + (s.monthly_fee || 0), 0);

  return {
    totalStudents,
    activeStudents,
    inactiveStudents,
    totalMonthlyRevenue,
  };
}

export interface PaymentSummaryResult {
  totalCount: number;
  totalAmount: number;
}

export function calculatePaymentSummary(payments: Payment[]): PaymentSummaryResult {
  const totalCount = payments.length;
  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return {
    totalCount,
    totalAmount,
  };
}

export interface AttendanceSummaryResult {
  totalStudents: number;
  totalPresent: number;
  totalAbsent: number;
  totalClasses: number;
  averageRate: number;
}

export function calculateAttendanceSummary(records: StudentMonthlyAttendance[]): AttendanceSummaryResult {
  const totalStudents = records.length;
  const totalPresent = records.reduce((sum, r) => sum + r.present_count, 0);
  const totalAbsent = records.reduce((sum, r) => sum + r.absent_count, 0);
  const totalClasses = records.length > 0 ? records[0].total_classes : 0;
  const totalPossible = totalStudents * totalClasses;
  const averageRate = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;

  return {
    totalStudents,
    totalPresent,
    totalAbsent,
    totalClasses,
    averageRate,
  };
}

export interface OutstandingDuesSummaryResult {
  totalRecords: number;
  totalAmountDue: number;
  totalAmountPaid: number;
  totalOutstanding: number;
}

export function calculateOutstandingDuesSummary(fees: MonthlyFee[]): OutstandingDuesSummaryResult {
  const totalRecords = fees.length;
  const totalAmountDue = fees.reduce((sum, f) => sum + (f.amount_due || 0), 0);
  const totalAmountPaid = fees.reduce((sum, f) => sum + (f.amount_paid || 0), 0);
  const totalOutstanding = fees.reduce((sum, f) => sum + (f.balance || 0), 0);

  return {
    totalRecords,
    totalAmountDue,
    totalAmountPaid,
    totalOutstanding,
  };
}

// ==============================================================================
// 2. SHARED HELPERS: BROWSER DOWNLOAD & DOCX BUILDER
// ==============================================================================

export async function downloadDocxBlob(doc: Document, filename: string): Promise<void> {
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildDocxDocument(params: {
  academyName: string;
  reportTitle: string;
  subtitle: string;
  headers: string[];
  alignments: ('left' | 'right')[];
  rows: (string | number)[][];
  footRow?: (string | number)[];
}): Document {
  const { academyName, reportTitle, subtitle, headers, alignments, rows, footRow } = params;

  const headerParagraphs = [
    new Paragraph({
      children: [
        new TextRun({
          text: academyName,
          bold: true,
          size: 32, // 16pt
          color: '1E293B',
        }),
      ],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: reportTitle,
          bold: true,
          size: 24, // 12pt
          color: '334155',
        }),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: subtitle,
          size: 18, // 9pt
          color: '64748B',
          italics: true,
        }),
      ],
      spacing: { after: 240 },
    }),
  ];

  const tableHeaderRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => {
      const isRight = alignments[i] === 'right';
      return new TableCell({
        shading: { fill: '1E293B' },
        children: [
          new Paragraph({
            alignment: isRight ? AlignmentType.RIGHT : AlignmentType.LEFT,
            children: [
              new TextRun({
                text: h,
                bold: true,
                color: 'FFFFFF',
                size: 18,
              }),
            ],
          }),
        ],
      });
    }),
  });

  const tableDataRows = rows.map((r, rowIndex) => {
    const isEven = rowIndex % 2 === 0;
    return new TableRow({
      children: r.map((val, colIndex) => {
        const isRight = alignments[colIndex] === 'right';
        return new TableCell({
          shading: isEven ? { fill: 'FFFFFF' } : { fill: 'F8FAFC' },
          children: [
            new Paragraph({
              alignment: isRight ? AlignmentType.RIGHT : AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: String(val ?? '—'),
                  size: 17,
                  color: '0F172A',
                }),
              ],
            }),
          ],
        });
      }),
    });
  });

  const tableRows = [tableHeaderRow, ...tableDataRows];

  if (footRow) {
    const footTableRow = new TableRow({
      children: footRow.map((val, colIndex) => {
        const isRight = alignments[colIndex] === 'right';
        return new TableCell({
          shading: { fill: 'F1F5F9' },
          children: [
            new Paragraph({
              alignment: isRight ? AlignmentType.RIGHT : AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: String(val ?? ''),
                  bold: true,
                  size: 18,
                  color: '0F172A',
                }),
              ],
            }),
          ],
        });
      }),
    });
    tableRows.push(footTableRow);
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });

  return new Document({
    sections: [
      {
        children: [...headerParagraphs, table],
      },
    ],
  });
}

function initPdfDocument(params: {
  academyName: string;
  reportTitle: string;
  subtitle: string;
  logoBase64?: string | null;
  orientation?: 'portrait' | 'landscape';
}): { doc: jsPDF; startY: number } {
  const { academyName, reportTitle, subtitle, logoBase64, orientation = 'portrait' } = params;
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const margin = 14;
  let currentY = 16;

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, currentY - 3, 16, 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(17, 24, 39);
      doc.text(academyName, margin + 20, currentY + 3);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.text(reportTitle, margin + 20, currentY + 8.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(subtitle, margin + 20, currentY + 13);
      currentY += 19;
    } catch {
      renderTextHeader();
    }
  } else {
    renderTextHeader();
  }

  function renderTextHeader() {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.text(academyName, margin, currentY);
    currentY += 5.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text(reportTitle, margin, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, margin, currentY);
    currentY += 7;
  }

  return { doc, startY: currentY };
}

// ==============================================================================
// 3. REPORT 1: STUDENT DIRECTORY (MIX-Students-YYYY-MM.pdf / .docx)
// ==============================================================================

export function exportStudentDirectoryPdf(params: {
  students: Student[];
  academySettings?: AcademySettings | null;
  logoBase64?: string | null;
  date?: Date;
}): void {
  const { students, academySettings, logoBase64, date = new Date() } = params;
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  const { totalStudents, activeStudents, totalMonthlyRevenue } = calculateStudentSummary(students);

  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const subtitle = `Total: ${totalStudents} students (${activeStudents} active) • Monthly Revenue: ${formatIndianCurrency(totalMonthlyRevenue)} • Generated: ${date.toLocaleString('en-IN')}`;

  const { doc, startY } = initPdfDocument({
    academyName,
    reportTitle: 'Student Directory',
    subtitle,
    logoBase64,
  });

  const headers = ['Student Name', 'Phone', 'Batch', 'Status', 'Monthly Fee', 'Enrolled'];
  const rows = students.map((s) => [
    s.full_name,
    s.phone || '—',
    s.batch?.name || 'Unassigned',
    s.status === 'active' ? 'Active' : 'Inactive',
    formatIndianCurrency(s.monthly_fee),
    formatDisplayDate(s.enrollment_date),
  ]);

  const foot = ['Total Active Revenue', '', '', `${activeStudents} Active`, formatIndianCurrency(totalMonthlyRevenue), ''];

  autoTable(doc, {
    head: [headers],
    body: rows,
    foot: [foot],
    startY,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      4: { halign: 'right' },
    },
  });

  doc.save(`MIX-Students-${ym}.pdf`);
}

export async function exportStudentDirectoryDocx(params: {
  students: Student[];
  academySettings?: AcademySettings | null;
  date?: Date;
}): Promise<void> {
  const { students, academySettings, date = new Date() } = params;
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  const { totalStudents, activeStudents, totalMonthlyRevenue } = calculateStudentSummary(students);

  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const subtitle = `Total: ${totalStudents} students (${activeStudents} active) • Monthly Revenue: ${formatIndianCurrency(totalMonthlyRevenue)} • Generated: ${date.toLocaleString('en-IN')}`;

  const headers = ['Student Name', 'Phone', 'Batch', 'Status', 'Monthly Fee', 'Enrolled'];
  const alignments: ('left' | 'right')[] = ['left', 'left', 'left', 'left', 'right', 'left'];
  const rows = students.map((s) => [
    s.full_name,
    s.phone || '—',
    s.batch?.name || 'Unassigned',
    s.status === 'active' ? 'Active' : 'Inactive',
    formatIndianCurrency(s.monthly_fee),
    formatDisplayDate(s.enrollment_date),
  ]);

  const footRow = ['Total Active Revenue', '', '', `${activeStudents} Active`, formatIndianCurrency(totalMonthlyRevenue), ''];

  const doc = buildDocxDocument({
    academyName,
    reportTitle: 'Student Directory',
    subtitle,
    headers,
    alignments,
    rows,
    footRow,
  });

  await downloadDocxBlob(doc, `MIX-Students-${ym}.docx`);
}

// ==============================================================================
// 4. REPORT 2: PAYMENT LEDGER (MIX-Payments-<range>.pdf / .docx)
// ==============================================================================

export function exportPaymentLedgerPdf(params: {
  payments: Payment[];
  rangeLabel?: string;
  academySettings?: AcademySettings | null;
  logoBase64?: string | null;
  date?: Date;
}): void {
  const { payments, rangeLabel = 'All', academySettings, logoBase64, date = new Date() } = params;
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  const { totalCount, totalAmount } = calculatePaymentSummary(payments);

  const subtitle = `Period: ${rangeLabel} • Total Collected: ${formatIndianCurrency(totalAmount)} across ${totalCount} transactions • Generated: ${date.toLocaleString('en-IN')}`;

  const { doc, startY } = initPdfDocument({
    academyName,
    reportTitle: 'Payment Ledger',
    subtitle,
    logoBase64,
  });

  const headers = ['Receipt #', 'Date', 'Student Name', 'Billing Month', 'Mode', 'Amount'];
  const rows = payments.map((p) => [
    p.receipt_number,
    formatDisplayDate(p.payment_date),
    p.student?.full_name || '—',
    p.monthly_fee?.billing_month ? formatBillingMonth(p.monthly_fee.billing_month) : '—',
    p.method.toUpperCase(),
    formatIndianCurrency(p.amount),
  ]);

  const foot = ['Total Amount Collected', '', '', '', `${totalCount} Payments`, formatIndianCurrency(totalAmount)];

  autoTable(doc, {
    head: [headers],
    body: rows,
    foot: [foot],
    startY,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      5: { halign: 'right' },
    },
  });

  const safeRange = rangeLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`MIX-Payments-${safeRange}.pdf`);
}

export async function exportPaymentLedgerDocx(params: {
  payments: Payment[];
  rangeLabel?: string;
  academySettings?: AcademySettings | null;
  date?: Date;
}): Promise<void> {
  const { payments, rangeLabel = 'All', academySettings, date = new Date() } = params;
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  const { totalCount, totalAmount } = calculatePaymentSummary(payments);

  const subtitle = `Period: ${rangeLabel} • Total Collected: ${formatIndianCurrency(totalAmount)} across ${totalCount} transactions • Generated: ${date.toLocaleString('en-IN')}`;

  const headers = ['Receipt #', 'Date', 'Student Name', 'Billing Month', 'Mode', 'Amount'];
  const alignments: ('left' | 'right')[] = ['left', 'left', 'left', 'left', 'left', 'right'];
  const rows = payments.map((p) => [
    p.receipt_number,
    formatDisplayDate(p.payment_date),
    p.student?.full_name || '—',
    p.monthly_fee?.billing_month ? formatBillingMonth(p.monthly_fee.billing_month) : '—',
    p.method.toUpperCase(),
    formatIndianCurrency(p.amount),
  ]);

  const footRow = ['Total Amount Collected', '', '', '', `${totalCount} Payments`, formatIndianCurrency(totalAmount)];

  const doc = buildDocxDocument({
    academyName,
    reportTitle: 'Payment Ledger',
    subtitle,
    headers,
    alignments,
    rows,
    footRow,
  });

  const safeRange = rangeLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  await downloadDocxBlob(doc, `MIX-Payments-${safeRange}.docx`);
}

// ==============================================================================
// 5. REPORT 3: BATCH ATTENDANCE (MIX-Attendance-<batch>-YYYY-MM.pdf / .docx)
// ==============================================================================

export function exportBatchAttendancePdf(params: {
  batchName: string;
  year: number;
  month: number;
  records: StudentMonthlyAttendance[];
  academySettings?: AcademySettings | null;
  logoBase64?: string | null;
  date?: Date;
}): void {
  const { batchName, year, month, records, academySettings, logoBase64, date = new Date() } = params;
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  const { totalStudents, totalPresent, totalAbsent, totalClasses, averageRate } = calculateAttendanceSummary(records);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = `${monthNames[month - 1]} ${year}`;
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const subtitle = `Batch: ${batchName} • Month: ${monthStr} • Students: ${totalStudents} • Classes Held: ${totalClasses} • Overall Attendance: ${averageRate}% • Generated: ${date.toLocaleString('en-IN')}`;

  const { doc, startY } = initPdfDocument({
    academyName,
    reportTitle: `Batch Attendance Report — ${batchName}`,
    subtitle,
    logoBase64,
  });

  const headers = ['Student Name', 'Classes Held', 'Present', 'Absent', 'Attendance %'];
  const rows = records.map((r) => [
    r.student_name,
    String(r.total_classes),
    String(r.present_count),
    String(r.absent_count),
    `${r.percentage}%`,
  ]);

  const foot = ['Batch Summary', `${totalClasses} Classes`, `${totalPresent} Pres.`, `${totalAbsent} Abs.`, `Avg: ${averageRate}%`];

  autoTable(doc, {
    head: [headers],
    body: rows,
    foot: [foot],
    startY,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  const safeBatch = batchName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`MIX-Attendance-${safeBatch}-${ym}.pdf`);
}

export async function exportBatchAttendanceDocx(params: {
  batchName: string;
  year: number;
  month: number;
  records: StudentMonthlyAttendance[];
  academySettings?: AcademySettings | null;
  date?: Date;
}): Promise<void> {
  const { batchName, year, month, records, academySettings, date = new Date() } = params;
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  const { totalStudents, totalPresent, totalAbsent, totalClasses, averageRate } = calculateAttendanceSummary(records);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = `${monthNames[month - 1]} ${year}`;
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const subtitle = `Batch: ${batchName} • Month: ${monthStr} • Students: ${totalStudents} • Classes Held: ${totalClasses} • Overall Attendance: ${averageRate}% • Generated: ${date.toLocaleString('en-IN')}`;

  const headers = ['Student Name', 'Classes Held', 'Present', 'Absent', 'Attendance %'];
  const alignments: ('left' | 'right')[] = ['left', 'right', 'right', 'right', 'right'];
  const rows = records.map((r) => [
    r.student_name,
    r.total_classes,
    r.present_count,
    r.absent_count,
    `${r.percentage}%`,
  ]);

  const footRow = ['Batch Summary', totalClasses, totalPresent, totalAbsent, `${averageRate}%`];

  const doc = buildDocxDocument({
    academyName,
    reportTitle: `Batch Attendance Report — ${batchName}`,
    subtitle,
    headers,
    alignments,
    rows,
    footRow,
  });

  const safeBatch = batchName.replace(/[^a-zA-Z0-9_-]/g, '_');
  await downloadDocxBlob(doc, `MIX-Attendance-${safeBatch}-${ym}.docx`);
}

// ==============================================================================
// 6. REPORT 4: 12-MONTH REVENUE BREAKDOWN (MIX-Revenue-YYYY.pdf / .docx)
// ==============================================================================

export function exportRevenueBreakdownPdf(params: {
  data: MonthlyIncomeDataPoint[];
  year: number;
  academySettings?: AcademySettings | null;
  logoBase64?: string | null;
  date?: Date;
}): void {
  const { data, year, academySettings, logoBase64, date = new Date() } = params;
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  const { rows, totalExpected, totalCollected, totalPending, overallRate } = calculateIncomeSummary(data);

  const subtitle = `Annual Summary ${year} • Expected: ${formatIndianCurrency(totalExpected)} • Collected: ${formatIndianCurrency(totalCollected)} (${overallRate}%) • Generated: ${date.toLocaleString('en-IN')}`;

  const { doc, startY } = initPdfDocument({
    academyName,
    reportTitle: `12-Month Revenue Breakdown (${year})`,
    subtitle,
    logoBase64,
  });

  const headers = ['Month', 'Expected Revenue', 'Collected Revenue', 'Pending Dues', 'Collection Rate'];
  const tableRows = rows.map((r) => [
    r['Month'],
    formatIndianCurrency(r['Expected Revenue (₹)']),
    formatIndianCurrency(r['Collected Revenue (₹)']),
    formatIndianCurrency(r['Pending Dues (₹)']),
    `${r['Collection Rate (%)']}%`,
  ]);

  const foot = [
    'Annual Total',
    formatIndianCurrency(totalExpected),
    formatIndianCurrency(totalCollected),
    formatIndianCurrency(totalPending),
    `${overallRate}%`,
  ];

  autoTable(doc, {
    head: [headers],
    body: tableRows,
    foot: [foot],
    startY,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  doc.save(`MIX-Revenue-${year}.pdf`);
}

export async function exportRevenueBreakdownDocx(params: {
  data: MonthlyIncomeDataPoint[];
  year: number;
  academySettings?: AcademySettings | null;
  date?: Date;
}): Promise<void> {
  const { data, year, academySettings, date = new Date() } = params;
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  const { rows, totalExpected, totalCollected, totalPending, overallRate } = calculateIncomeSummary(data);

  const subtitle = `Annual Summary ${year} • Expected: ${formatIndianCurrency(totalExpected)} • Collected: ${formatIndianCurrency(totalCollected)} (${overallRate}%) • Generated: ${date.toLocaleString('en-IN')}`;

  const headers = ['Month', 'Expected Revenue', 'Collected Revenue', 'Pending Dues', 'Collection Rate'];
  const alignments: ('left' | 'right')[] = ['left', 'right', 'right', 'right', 'right'];
  const tableRows = rows.map((r) => [
    r['Month'],
    formatIndianCurrency(r['Expected Revenue (₹)']),
    formatIndianCurrency(r['Collected Revenue (₹)']),
    formatIndianCurrency(r['Pending Dues (₹)']),
    `${r['Collection Rate (%)']}%`,
  ]);

  const footRow = [
    'Annual Total',
    formatIndianCurrency(totalExpected),
    formatIndianCurrency(totalCollected),
    formatIndianCurrency(totalPending),
    `${overallRate}%`,
  ];

  const doc = buildDocxDocument({
    academyName,
    reportTitle: `12-Month Revenue Breakdown (${year})`,
    subtitle,
    headers,
    alignments,
    rows: tableRows,
    footRow,
  });

  await downloadDocxBlob(doc, `MIX-Revenue-${year}.docx`);
}

// ==============================================================================
// 7. REPORT 5: 12-MONTH INCOME STATEMENT (MIX-Income-YYYY-MM.pdf / .docx)
// ==============================================================================

export function exportIncomeStatementPdf(params: {
  data: MonthlyIncomeDataPoint[];
  academySettings?: AcademySettings | null;
  logoBase64?: string | null;
  date?: Date;
}): void {
  const { data, academySettings, logoBase64, date = new Date() } = params;
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  const { rows, totalExpected, totalCollected, totalPending, overallRate } = calculateIncomeSummary(data);

  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const subtitle = `Trailing 12 Months Financial Statement • Total Income: ${formatIndianCurrency(totalCollected)} • Uncollected: ${formatIndianCurrency(totalPending)} • Generated: ${date.toLocaleString('en-IN')}`;

  const { doc, startY } = initPdfDocument({
    academyName,
    reportTitle: '12-Month Income Statement',
    subtitle,
    logoBase64,
  });

  const headers = ['Billing Month', 'Invoiced Amount', 'Realized Revenue', 'Uncollected Dues', 'Collection %'];
  const tableRows = rows.map((r) => [
    r['Month'],
    formatIndianCurrency(r['Expected Revenue (₹)']),
    formatIndianCurrency(r['Collected Revenue (₹)']),
    formatIndianCurrency(r['Pending Dues (₹)']),
    `${r['Collection Rate (%)']}%`,
  ]);

  const foot = [
    'Total / Average',
    formatIndianCurrency(totalExpected),
    formatIndianCurrency(totalCollected),
    formatIndianCurrency(totalPending),
    `${overallRate}%`,
  ];

  autoTable(doc, {
    head: [headers],
    body: tableRows,
    foot: [foot],
    startY,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  doc.save(`MIX-Income-${ym}.pdf`);
}

export async function exportIncomeStatementDocx(params: {
  data: MonthlyIncomeDataPoint[];
  academySettings?: AcademySettings | null;
  date?: Date;
}): Promise<void> {
  const { data, academySettings, date = new Date() } = params;
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  const { rows, totalExpected, totalCollected, totalPending, overallRate } = calculateIncomeSummary(data);

  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const subtitle = `Trailing 12 Months Financial Statement • Total Income: ${formatIndianCurrency(totalCollected)} • Uncollected: ${formatIndianCurrency(totalPending)} • Generated: ${date.toLocaleString('en-IN')}`;

  const headers = ['Billing Month', 'Invoiced Amount', 'Realized Revenue', 'Uncollected Dues', 'Collection %'];
  const alignments: ('left' | 'right')[] = ['left', 'right', 'right', 'right', 'right'];
  const tableRows = rows.map((r) => [
    r['Month'],
    formatIndianCurrency(r['Expected Revenue (₹)']),
    formatIndianCurrency(r['Collected Revenue (₹)']),
    formatIndianCurrency(r['Pending Dues (₹)']),
    `${r['Collection Rate (%)']}%`,
  ]);

  const footRow = [
    'Total / Average',
    formatIndianCurrency(totalExpected),
    formatIndianCurrency(totalCollected),
    formatIndianCurrency(totalPending),
    `${overallRate}%`,
  ];

  const doc = buildDocxDocument({
    academyName,
    reportTitle: '12-Month Income Statement',
    subtitle,
    headers,
    alignments,
    rows: tableRows,
    footRow,
  });

  await downloadDocxBlob(doc, `MIX-Income-${ym}.docx`);
}

// ==============================================================================
// 8. REPORT 6: OUTSTANDING STUDENT DUES (MIX-Outstanding-Dues-YYYY-MM.pdf / .docx)
// ==============================================================================

export function exportOutstandingDuesPdf(params: {
  overdueFees: MonthlyFee[];
  academySettings?: AcademySettings | null;
  logoBase64?: string | null;
  date?: Date;
}): void {
  const { overdueFees, academySettings, logoBase64, date = new Date() } = params;
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  const { totalRecords, totalAmountDue, totalAmountPaid, totalOutstanding } = calculateOutstandingDuesSummary(overdueFees);

  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const subtitle = `Total Overdue Dues: ${formatIndianCurrency(totalOutstanding)} across ${totalRecords} records • Generated: ${date.toLocaleString('en-IN')}`;

  const { doc, startY } = initPdfDocument({
    academyName,
    reportTitle: 'Outstanding Student Dues Report',
    subtitle,
    logoBase64,
  });

  const headers = ['Student Name', 'Batch', 'Phone', 'Month', 'Due Date', 'Fee', 'Paid', 'Outstanding'];
  const rows = overdueFees.map((f) => [
    f.student?.full_name || '—',
    f.student?.batch?.name || 'Unassigned',
    f.student?.phone || '—',
    formatBillingMonth(f.billing_month),
    formatDisplayDate(f.due_date),
    formatIndianCurrency(f.amount_due),
    formatIndianCurrency(f.amount_paid || 0),
    formatIndianCurrency(f.balance || 0),
  ]);

  const foot = [
    'Total Outstanding',
    '',
    '',
    '',
    `${totalRecords} Overdue`,
    formatIndianCurrency(totalAmountDue),
    formatIndianCurrency(totalAmountPaid),
    formatIndianCurrency(totalOutstanding),
  ];

  autoTable(doc, {
    head: [headers],
    body: rows,
    foot: [foot],
    startY,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
  });

  doc.save(`MIX-Outstanding-Dues-${ym}.pdf`);
}

export async function exportOutstandingDuesDocx(params: {
  overdueFees: MonthlyFee[];
  academySettings?: AcademySettings | null;
  date?: Date;
}): Promise<void> {
  const { overdueFees, academySettings, date = new Date() } = params;
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  const { totalRecords, totalAmountDue, totalAmountPaid, totalOutstanding } = calculateOutstandingDuesSummary(overdueFees);

  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const subtitle = `Total Overdue Dues: ${formatIndianCurrency(totalOutstanding)} across ${totalRecords} records • Generated: ${date.toLocaleString('en-IN')}`;

  const headers = ['Student Name', 'Batch', 'Phone', 'Month', 'Due Date', 'Fee', 'Paid', 'Outstanding'];
  const alignments: ('left' | 'right')[] = ['left', 'left', 'left', 'left', 'left', 'right', 'right', 'right'];
  const rows = overdueFees.map((f) => [
    f.student?.full_name || '—',
    f.student?.batch?.name || 'Unassigned',
    f.student?.phone || '—',
    formatBillingMonth(f.billing_month),
    formatDisplayDate(f.due_date),
    formatIndianCurrency(f.amount_due),
    formatIndianCurrency(f.amount_paid || 0),
    formatIndianCurrency(f.balance || 0),
  ]);

  const footRow = [
    'Total Outstanding',
    '',
    '',
    '',
    `${totalRecords} Overdue`,
    formatIndianCurrency(totalAmountDue),
    formatIndianCurrency(totalAmountPaid),
    formatIndianCurrency(totalOutstanding),
  ];

  const doc = buildDocxDocument({
    academyName,
    reportTitle: 'Outstanding Student Dues Report',
    subtitle,
    headers,
    alignments,
    rows,
    footRow,
  });

  await downloadDocxBlob(doc, `MIX-Outstanding-Dues-${ym}.docx`);
}
