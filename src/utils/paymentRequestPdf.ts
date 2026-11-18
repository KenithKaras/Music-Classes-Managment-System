import { jsPDF } from 'jspdf';
import type { AcademySettings } from '../types';
import { formatIndianCurrency, formatBillingMonth } from './feeUtils';
import { loadImageAsBase64 } from './receiptPdf';

export interface GeneratePaymentRequestPdfParams {
  studentName: string;
  billingMonth: string;
  balanceDue: number;
  dueDate: string;
  academySettings?: AcademySettings | null;
  qrDataUrl?: string | null;
  upiId?: string | null;
}

/**
 * Generates an official, high-contrast, professional A5 Payment Request PDF.
 * Note: Static QR does not encode amount; amount is boldly specified in text.
 */
export async function generatePaymentRequestPdf(
  params: GeneratePaymentRequestPdfParams
): Promise<jsPDF> {
  const {
    studentName,
    billingMonth,
    balanceDue,
    dueDate,
    academySettings,
    qrDataUrl,
    upiId,
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 148 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 120 mm
  let currentY = 14;

  // 1. Academy Logo if available
  if (academySettings?.logo_url) {
    const logoBase64 = await loadImageAsBase64(academySettings.logo_url);
    if (logoBase64) {
      try {
        const logoSize = 14;
        doc.addImage(logoBase64, 'PNG', (pageWidth - logoSize) / 2, currentY, logoSize, logoSize);
        currentY += logoSize + 4;
      } catch {
        // Fallback without logo
      }
    }
  }

  // Academy Name
  const academyName = academySettings?.academy_name || 'MIX with Me Classes';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(academyName, pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  // Contact info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // slate-600
  const contactParts: string[] = [];
  if (academySettings?.contact_number) contactParts.push(`Ph: ${academySettings.contact_number}`);
  if (academySettings?.email) contactParts.push(academySettings.email);
  if (contactParts.length > 0) {
    doc.text(contactParts.join(' | '), pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;
  }

  // Divider
  currentY += 2;
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // 2. Banner: PAYMENT REQUEST
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(margin, currentY, contentWidth, 10, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('PAYMENT REQUEST', margin + 4, currentY + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229); // indigo-600
  const monthLabel = formatBillingMonth(billingMonth);
  doc.text(`For: ${monthLabel}`, pageWidth - margin - 4, currentY + 6.5, { align: 'right' });
  currentY += 14;

  // 3. Bill & Student Summary Box
  const leftX = margin + 4;
  const rightX = pageWidth / 2 + 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Student Name:', leftX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(studentName, leftX + 26, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Due Date:', rightX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(dueDate, rightX + 20, currentY);
  currentY += 7;

  // Amount Highlight Box
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.setDrawColor(199, 210, 254); // indigo-200
  doc.roundedRect(margin, currentY, contentWidth, 13, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text('Total Balance Due:', margin + 6, currentY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(49, 46, 129); // indigo-900
  doc.text(formatIndianCurrency(balanceDue), pageWidth - margin - 6, currentY + 8.5, {
    align: 'right',
  });
  currentY += 18;

  // 4. UPI QR Code Section (Center)
  const effectiveUpi = upiId || academySettings?.upi_id || 'Not configured';
  let qrBase64 = qrDataUrl;
  if (!qrBase64 && academySettings?.upi_qr_path) {
    qrBase64 = await loadImageAsBase64(academySettings.upi_qr_path);
  }

  if (qrBase64) {
    try {
      const qrBoxSize = 50; // 50x50 mm
      const qrX = (pageWidth - qrBoxSize) / 2;
      doc.addImage(qrBase64, 'PNG', qrX, currentY, qrBoxSize, qrBoxSize);
      currentY += qrBoxSize + 4;
    } catch {
      // If image failed
    }
  }

  // UPI ID Text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`UPI ID: ${effectiveUpi}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 6;

  // 5. Instruction line required by spec
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const instruction =
    'Scan with any UPI app and enter the amount shown above. Send the transaction ID to the academy after paying.';
  const splitInstruction = doc.splitTextToSize(instruction, contentWidth - 4);
  doc.text(splitInstruction, pageWidth / 2, currentY, { align: 'center' });

  return doc;
}

/**
 * Downloads the Payment Request PDF in the browser.
 */
export async function downloadPaymentRequestPdf(
  params: GeneratePaymentRequestPdfParams
): Promise<void> {
  const doc = await generatePaymentRequestPdf(params);
  const cleanName = params.studentName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `MIX-Payment-Request-${cleanName}-${params.billingMonth}.pdf`;
  doc.save(filename);
}
