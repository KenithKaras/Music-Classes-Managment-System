import { jsPDF } from 'jspdf';
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
import type { Payment, AcademySettings } from '../types';
import { formatIndianCurrency, formatBillingMonth } from './feeUtils';

export interface GenerateReceiptPdfParams {
  payment: Payment;
  academySettings?: AcademySettings | null;
  balanceRemaining?: number;
  logoBase64?: string | null;
}

/**
 * Loads an image from a URL and converts it to a base64 data URL.
 * Returns null if the URL is invalid or loading fails.
 */
export async function loadImageAsBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Generates a clean, professional A5-sized receipt PDF using jsPDF.
 * If academy logo is provided, renders the logo in the header.
 * Otherwise renders with academy name typography only.
 */
export function generateReceiptPdf(params: GenerateReceiptPdfParams): jsPDF {
  const { payment, academySettings, balanceRemaining = 0, logoBase64 } = params;

  // A5 format: 148mm wide, 210mm tall
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 148
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 120

  let currentY = 14;

  // 1. Academy Header (with optional Logo)
  if (logoBase64) {
    try {
      const logoSize = 14; // 14x14 mm
      doc.addImage(logoBase64, 'PNG', (pageWidth - logoSize) / 2, currentY, logoSize, logoSize);
      currentY += logoSize + 4;
    } catch {
      // Fallback without logo
    }
  }

  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(17, 24, 39); // Gray 900
  doc.text(academyName, pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99); // Gray 600

  const contactPieces: string[] = [];
  if (academySettings?.contact_number) contactPieces.push(`Ph: ${academySettings.contact_number}`);
  if (academySettings?.email) contactPieces.push(academySettings.email);
  if (contactPieces.length > 0) {
    doc.text(contactPieces.join(' | '), pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;
  }

  if (academySettings?.address) {
    doc.text(academySettings.address, pageWidth / 2, currentY, { align: 'center' });
    currentY += 4.5;
  }

  currentY += 2;

  // Divider Line
  doc.setDrawColor(229, 231, 235); // Gray 200
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // 2. Receipt Title & Meta Bar
  doc.setFillColor(243, 244, 246); // Gray 100
  doc.roundedRect(margin, currentY, contentWidth, 11, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 58, 138); // Indigo / Navy
  doc.text('PAYMENT RECEIPT', margin + 4, currentY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81); // Gray 700
  doc.text(`No: ${payment.receipt_number}`, pageWidth - margin - 4, currentY + 7, {
    align: 'right',
  });

  currentY += 15;

  // 3. Date & Student Info Box
  const leftColX = margin + 2;
  const rightColX = pageWidth / 2 + 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128); // Gray 500
  doc.text('Payment Date:', leftColX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(payment.payment_date, leftColX + 24, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Payment Mode:', rightColX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  const methodLabel =
    payment.method === 'upi' && payment.upi_txn_id
      ? `UPI (UTR: ${payment.upi_txn_id})`
      : payment.method.toUpperCase().replace('_', ' ');
  doc.text(methodLabel, rightColX + 24, currentY);

  currentY += 6.5;

  // Student details
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Student Name:', leftColX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(payment.student?.full_name || 'N/A', leftColX + 24, currentY);

  if (payment.student?.guardian_name) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('Guardian:', rightColX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(payment.student.guardian_name, rightColX + 24, currentY);
  }

  currentY += 8.5;

  // 4. Details Table
  const tableY = currentY;
  const tableHeaderHeight = 6.5;
  const tableRowHeight = 8.5;

  // Header background
  doc.setFillColor(249, 250, 251); // Gray 50
  doc.rect(margin, tableY, contentWidth, tableHeaderHeight, 'F');
  doc.setDrawColor(209, 213, 219); // Gray 300
  doc.line(margin, tableY + tableHeaderHeight, pageWidth - margin, tableY + tableHeaderHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  doc.text('Description', margin + 4, tableY + 4.5);
  doc.text('Amount (INR)', pageWidth - margin - 4, tableY + 4.5, { align: 'right' });

  let rowY = tableY + tableHeaderHeight;

  // Row 1: Fee Description
  const billingMonthStr = payment.monthly_fee?.billing_month
    ? formatBillingMonth(payment.monthly_fee.billing_month)
    : 'Music Class Fee';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(31, 41, 55);
  doc.text(`Music Class Fee - ${billingMonthStr}`, margin + 4, rowY + 5.2);

  const amountDue = payment.monthly_fee?.amount_due;
  if (amountDue !== undefined) {
    doc.text(formatIndianCurrency(amountDue), pageWidth - margin - 4, rowY + 5.2, {
      align: 'right',
    });
  }

  rowY += tableRowHeight;
  doc.setDrawColor(243, 244, 246);
  doc.line(margin, rowY, pageWidth - margin, rowY);

  // Row 2: Paid Amount (Highlight)
  doc.setFillColor(239, 246, 255); // Blue 50
  doc.rect(margin, rowY, contentWidth, tableRowHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138); // Blue 900
  doc.text('Amount Paid in this Transaction', margin + 4, rowY + 5.5);
  doc.text(formatIndianCurrency(payment.amount), pageWidth - margin - 4, rowY + 5.5, {
    align: 'right',
  });

  rowY += tableRowHeight;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, rowY, pageWidth - margin, rowY);

  // Row 3: Remaining Balance
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text('Remaining Balance for this Month', margin + 4, rowY + 5.2);

  doc.setFont('helvetica', 'bold');
  if (balanceRemaining > 0) {
    doc.setTextColor(185, 28, 28); // Red 700
  } else {
    doc.setTextColor(16, 149, 102); // Green 600
  }
  doc.text(
    balanceRemaining > 0 ? formatIndianCurrency(balanceRemaining) : '₹0 (PAID IN FULL)',
    pageWidth - margin - 4,
    rowY + 5.2,
    { align: 'right' }
  );

  rowY += tableRowHeight;

  // Notes if any
  if (payment.notes) {
    rowY += 3.5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text(`Note: ${payment.notes}`, margin + 2, rowY);
    rowY += 3.5;
  }

  // 5. Signature and Footer
  const footerY = 178;

  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.4);
  doc.line(pageWidth - margin - 40, footerY, pageWidth - margin, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text('Authorized Signatory', pageWidth - margin - 20, footerY + 3.5, { align: 'center' });
  doc.text(academyName, pageWidth - margin - 20, footerY + 6.5, { align: 'center' });

  // Timestamp and system note
  const now = new Date();
  const generatedTimeStr = now.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.setFontSize(6.5);
  doc.setTextColor(156, 163, 175);
  doc.text(`Generated on ${generatedTimeStr}`, margin, footerY + 10);
  doc.text('This is a computer-generated receipt.', margin, footerY + 13.5);
  doc.text('Thank you for learning with us!', pageWidth - margin, footerY + 13.5, { align: 'right' });

  return doc;
}

/**
 * Downloads the receipt PDF, automatically attempting to load the logo if present.
 * Filename: Receipt-[receipt_number].pdf
 */
export async function downloadReceiptPdf(params: GenerateReceiptPdfParams): Promise<void> {
  let logoBase64 = params.logoBase64;
  if (!logoBase64 && params.academySettings?.logo_url) {
    logoBase64 = await loadImageAsBase64(params.academySettings.logo_url);
  }

  const doc = generateReceiptPdf({
    ...params,
    logoBase64,
  });

  const filename = `MIX-Receipt-${params.payment.receipt_number}.pdf`;
  doc.save(filename);
}

/**
 * Generates and downloads the official receipt as a Word document (.docx).
 * Filename: MIX-Receipt-[receipt_number].docx
 */
export async function downloadReceiptDocx(params: GenerateReceiptPdfParams): Promise<void> {
  const { payment, academySettings, balanceRemaining = 0 } = params;
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  const methodLabel =
    payment.method === 'upi' && payment.upi_txn_id
      ? `UPI (UTR: ${payment.upi_txn_id})`
      : payment.method.toUpperCase().replace('_', ' ');

  const billingMonthStr = payment.monthly_fee?.billing_month
    ? formatBillingMonth(payment.monthly_fee.billing_month)
    : 'Music Class Fee';

  const statusLabel = balanceRemaining <= 0 ? 'PAID IN FULL' : 'PARTIALLY PAID';

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: academyName, bold: true, size: 32, color: '0F172A' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${academySettings?.contact_number ? 'Ph: ' + academySettings.contact_number + ' | ' : ''}${academySettings?.email || ''}`,
                size: 18,
                color: '64748B',
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'OFFICIAL FEE RECEIPT', bold: true, size: 24, color: '4338CA' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Receipt No: ${payment.receipt_number}`, bold: true, size: 20, color: '334155' }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Student Name', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph(payment.student?.full_name || 'N/A')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Payment Date', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph(payment.payment_date)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Billing Month', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph(billingMonthStr)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Payment Method', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph(methodLabel)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Amount Paid', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatIndianCurrency(payment.amount), bold: true, color: '4338CA' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Balance Remaining', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph(balanceRemaining > 0 ? formatIndianCurrency(balanceRemaining) : '₹0')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: statusLabel, bold: true, color: balanceRemaining <= 0 ? '059669' : 'D97706' })] })] }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'This is a computer-generated receipt. MIX with Me Classes.',
                italics: true,
                size: 16,
                color: '94A3B8',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MIX-Receipt-${payment.receipt_number}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
