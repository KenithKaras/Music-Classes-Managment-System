import type { FeeStatus } from '../types';

/**
 * Formats an integer amount in Indian Rupees (₹) with standard Indian grouping (e.g. ₹1,50,000).
 */
export function formatIndianCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }
  const integerAmount = Math.round(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.abs(integerAmount));

  return integerAmount < 0 ? `-₹${formatted}` : `₹${formatted}`;
}

/**
 * Calculates remaining balance given amount due and already paid.
 * Balance is always non-negative.
 */
export function calculateFeeBalance(amountDue: number, amountPaid: number): number {
  const safeDue = Math.max(0, Math.round(amountDue || 0));
  const safePaid = Math.max(0, Math.round(amountPaid || 0));
  return Math.max(0, safeDue - safePaid);
}

/**
 * Determines fee status:
 * - 'paid': amountPaid >= amountDue
 * - 'overdue': unpaid balance remaining AND past due date
 * - 'partial': 0 < amountPaid < amountDue AND not yet past due date
 * - 'pending': amountPaid === 0 AND not yet past due date
 */
export function getFeeStatus(
  amountDue: number,
  amountPaid: number,
  dueDateStr: string,
  asOfDate: Date = new Date()
): FeeStatus {
  const safeDue = Math.max(0, amountDue || 0);
  const safePaid = Math.max(0, amountPaid || 0);

  if (safePaid >= safeDue && safeDue > 0) {
    return 'paid';
  }

  // Check if past due date
  const [year, month, day] = dueDateStr.split('-').map(Number);
  const dueDate = new Date(year, month - 1, day, 23, 59, 59); // end of due day

  const isPastDue = asOfDate.getTime() > dueDate.getTime();

  if (isPastDue) {
    return 'overdue';
  }

  if (safePaid > 0) {
    return 'partial';
  }

  return 'pending';
}

/**
 * Calculates number of days a payment is overdue past its due date.
 * Returns 0 if current date is before or on due date.
 */
export function calculateDaysOverdue(dueDateStr: string, asOfDate: Date = new Date()): number {
  if (!dueDateStr) return 0;
  const [year, month, day] = dueDateStr.split('-').map(Number);
  const dueDate = new Date(year, month - 1, day);

  // Normalize asOfDate to local midnight
  const currentMidnight = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate());

  const diffMs = currentMidnight.getTime() - dueDate.getTime();
  if (diffMs <= 0) {
    return 0;
  }

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Cleans an Indian mobile phone number for WhatsApp wa.me link.
 * Returns a 12-digit string starting with 91 (e.g. 919876543210), or null if invalid.
 */
export function cleanIndianPhoneForWhatsApp(phoneStr: string | null | undefined): string | null {
  if (!phoneStr) return null;

  // Extract all digits
  let digits = phoneStr.replace(/\D/g, '');

  // Strip leading 0
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // Strip leading 91 if full 12 digits
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.substring(2);
  }

  // Must be 10 digits starting with 6, 7, 8, or 9
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }

  return null;
}

/**
 * Builds the WhatsApp reminder text template per requirements.
 */
export function buildWhatsAppReminderMessage(params: {
  studentName: string;
  guardianName?: string | null;
  balance: number;
  monthName: string;
  dueDateStr: string;
  academyName?: string;
}): string {
  const {
    studentName,
    guardianName,
    balance,
    monthName,
    dueDateStr,
    academyName = 'MIX with Me Classes',
  } = params;

  const recipient = guardianName ? guardianName.trim() : studentName.trim();
  const formattedBalance = new Intl.NumberFormat('en-IN').format(balance);

  // Format due date friendly (e.g. 5 Nov 2026)
  let formattedDue = dueDateStr;
  try {
    const [y, m, d] = dueDateStr.split('-').map(Number);
    formattedDue = new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    formattedDue = dueDateStr;
  }

  return `Hello ${recipient}, this is a reminder from ${academyName}. ₹${formattedBalance} is pending for ${studentName} for ${monthName}, due on ${formattedDue}. Thank you.`;
}

/**
 * Sanitizes message text by trimming and stripping non-printable control characters.
 */
export function sanitizeWhatsAppMessage(text: string): string {
  if (!text) return '';
  return text.trim().replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
}

/**
 * Builds the wa.me click-to-chat URL with sanitized phone digits and message.
 */
export function buildWhatsAppUrl(phone12Digits: string, message: string): string {
  const digitsOnly = phone12Digits.replace(/\D/g, '');
  const sanitizedText = sanitizeWhatsAppMessage(message);
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(sanitizedText)}`;
}

/**
 * Formats a billing_month string ("2026-11-01") to human friendly format ("November 2026").
 */
export function formatBillingMonth(billingMonthDateStr: string): string {
  if (!billingMonthDateStr) return '';
  const [year, month] = billingMonthDateStr.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Returns the normalized billing month date string (YYYY-MM-01) for a given Date.
 */
export function getBillingMonthDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}
