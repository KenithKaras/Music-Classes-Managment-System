import QRCode from 'qrcode';
import { formatIndianCurrency } from './feeUtils';

/**
 * Validates a UPI ID / VPA.
 * Rule: format name@handle
 * - Local part: lowercase letters, digits, dots, hyphens, underscores
 * - Handle: 2 to 64 letters
 * - Empty string is allowed (UPI disabled).
 */
export function validateUpiId(upiId: string): { isValid: boolean; error: string | null } {
  const trimmed = upiId.trim();
  if (!trimmed) {
    return { isValid: true, error: null };
  }
  const upiRegex = /^[a-z0-9._-]+@[a-zA-Z]{2,64}$/;
  if (!upiRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid UPI ID format. Must be name@handle (lowercase letters, digits, dots, hyphens, underscores, followed by @ and a 2-64 letter handle).',
    };
  }
  return { isValid: true, error: null };
}

/**
 * Normalizes and caps Payee Name to 60 characters max.
 * Defaults to the academy name if empty.
 */
export function formatPayeeName(payeeName: string | undefined | null, defaultAcademyName: string): string {
  const trimmed = (payeeName || '').trim();
  const base = trimmed || defaultAcademyName.trim() || 'MIX with Me Classes';
  return base.slice(0, 60);
}

/**
 * Builds the canonical static UPI payment URI according to NPCI specs.
 * Format: upi://pay?pa=<UPI ID>&pn=<payee name>&cu=INR
 * Does NOT embed an amount so it can be safely reused across all students.
 */
export function buildUpiPayUri(upiId: string, payeeName: string): string {
  const cleanId = upiId.trim();
  const cleanName = payeeName.trim().slice(0, 60);
  return `upi://pay?pa=${encodeURIComponent(cleanId)}&pn=${encodeURIComponent(cleanName)}&cu=INR`;
}

/**
 * Generates a PNG Data URL QR code in the browser using the qrcode package.
 * Error correction level: M.
 */
export async function generateUpiQrDataUrl(upiUri: string): Promise<string> {
  return QRCode.toDataURL(upiUri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

/**
 * Converts a base64 data URL (e.g. data:image/png;base64,iVBORw0KGgo...)
 * directly to a Blob without using window.fetch, avoiding CSP connect-src violations.
 */
export function dataUrlToBlob(dataUrl: string, fallbackMime = 'image/png'): Blob {
  const commaIndex = dataUrl.indexOf(',');
  let mimeType = fallbackMime;
  if (commaIndex !== -1) {
    const header = dataUrl.slice(0, commaIndex);
    const match = header.match(/data:([^;]+)/);
    if (match && match[1]) {
      mimeType = match[1];
    }
  }
  const base64Data = commaIndex !== -1 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Validates a UPI Transaction ID / UTR number.
 * Rule: 6 to 35 alphanumeric characters, stored in uppercase.
 */
export function validateUpiTxnId(utr: string): { isValid: boolean; error: string | null; formatted: string } {
  const cleaned = utr.trim().toUpperCase();
  if (!cleaned) {
    return {
      isValid: false,
      error: 'UPI Transaction ID (UTR) is required.',
      formatted: '',
    };
  }
  const utrRegex = /^[A-Z0-9]{6,35}$/;
  if (!utrRegex.test(cleaned)) {
    return {
      isValid: false,
      error: 'UPI Transaction ID (UTR) must be 6 to 35 letters and digits.',
      formatted: cleaned,
    };
  }
  return { isValid: true, error: null, formatted: cleaned };
}

/**
 * Cleans phone number to exactly 10 Indian digits for wa.me link.
 * Handles numbers with or without +91 or spaces/dashes.
 */
export function cleanIndianPhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
    return digitsOnly;
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91') && /^[6-9]/.test(digitsOnly.slice(2))) {
    return digitsOnly.slice(2);
  }
  return null;
}

/**
 * Builds the WhatsApp payment request message and wa.me link.
 */
export function buildPaymentRequestWhatsAppUrl(params: {
  phone: string;
  studentName: string;
  balanceDue: number;
  upiId: string;
  dueDate: string;
  academyName: string;
}): { url: string | null; message: string; isPhoneValid: boolean } {
  const cleanDigits = cleanIndianPhoneNumber(params.phone);
  const formattedBalance = formatIndianCurrency(params.balanceDue);

  const message = `Hello, this is a payment request from ${params.academyName}. Balance due for ${params.studentName} is ${formattedBalance}, due by ${params.dueDate}. Please scan our academy UPI QR or pay directly to UPI ID: ${params.upiId}. Kindly send the UPI transaction ID (UTR) after payment. Thank you!`;

  if (!cleanDigits) {
    return {
      url: null,
      message,
      isPhoneValid: false,
    };
  }

  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/91${cleanDigits}?text=${encodedMessage}`;

  return {
    url,
    message,
    isPhoneValid: true,
  };
}
