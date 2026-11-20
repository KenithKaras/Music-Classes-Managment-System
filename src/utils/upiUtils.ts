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
 * Retrieves the list of allowed academy UPI IDs from VITE_ALLOWED_UPI_IDS.
 * Compares case-insensitively, exact match only.
 * Fails closed: if VITE_ALLOWED_UPI_IDS is empty or missing, returns an empty array.
 */
export function getAllowedUpiIds(customAllowed?: string): string[] {
  let envVal = '';
  if (customAllowed !== undefined) {
    envVal = customAllowed;
  } else {
    try {
      envVal = import.meta.env.VITE_ALLOWED_UPI_IDS || '';
    } catch {
      envVal = (typeof process !== 'undefined' ? process.env?.VITE_ALLOWED_UPI_IDS : undefined) || '';
    }
  }

  const raw = (envVal || '').trim();
  if (!raw) {
    let isDev = false;
    try {
      isDev = !!import.meta.env.DEV;
    } catch {
      isDev = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
    }
    if (isDev) {
      console.warn('VITE_ALLOWED_UPI_IDS is empty or missing. Rejecting payment link (fail closed).');
    }
    return [];
  }

  return raw
    .split(',')
    .map((id: string) => id.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Checks if a given UPI ID is in the allowlist.
 * Case-insensitive, exact match only.
 * Fails closed if allowlist is empty.
 */
export function isUpiIdAllowed(upiId: string, customAllowed?: string): boolean {
  const cleanId = (upiId || '').trim().toLowerCase();
  if (!cleanId) return false;
  const allowed = getAllowedUpiIds(customAllowed);
  if (allowed.length === 0) return false; // fail closed
  return allowed.includes(cleanId);
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
 * Optional: empty string is accepted as valid.
 */
export function validateUpiTxnId(utr: string): { isValid: boolean; error: string | null; formatted: string } {
  const cleaned = utr.trim().toUpperCase();
  if (!cleaned) {
    return {
      isValid: true,
      error: null,
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
 * Generates a cryptographically random transaction reference (tr) parameter.
 * Length: 12 to 20 uppercase alphanumeric characters (NPCI format).
 * Does not derive from student or fee ID.
 */
export function generateRandomTr(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const validLen = Math.min(20, Math.max(12, length));
  const array = new Uint8Array(validLen);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

/**
 * Formats a fee note strictly conforming to: "Music fees <Mon YYYY>" (e.g. "Music fees Nov 2026").
 * Never includes student's name, phone, or ID.
 */
export function formatFeeNote(billingMonthStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = (billingMonthStr || '').split('-');
  if (parts.length >= 2) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12 && /^\d{4}$/.test(year)) {
      return `Music fees ${months[monthIdx]} ${year}`;
    }
  }
  return 'Music fees';
}

export interface BuildHttpsPaymentUrlParams {
  upiId: string;
  payeeName: string;
  amount: number;
  billingMonth?: string;
  note?: string;
  tr?: string;
  origin?: string;
  allowedUpiIds?: string;
}

/**
 * Builds the per-request HTTPS payment URL:
 * https://<origin>/pay?pa=<UPI ID>&pn=<payee name>&am=<balance>&tn=<note>&tr=<reference>
 * 
 * Rejects if:
 * - balance is 0 or less
 * - amount exceeds 100,000.00
 * - UPI ID is missing, invalid, or not in the VITE_ALLOWED_UPI_IDS allowlist
 * - note or reference fails format
 */
export function buildHttpsPaymentUrl(params: BuildHttpsPaymentUrlParams): { url: string | null; error: string | null } {
  const { amount, upiId, payeeName, billingMonth, note: customNote, tr: customTr, origin: customOrigin, allowedUpiIds } = params;

  // 1. Validate balance / amount
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    return { url: null, error: 'Amount must be greater than zero.' };
  }
  if (amount > 100000) {
    return { url: null, error: 'Amount exceeds maximum allowed limit of ₹1,00,000.00.' };
  }

  // 2. Validate UPI ID format and allowlist check (fails closed if allowlist empty/missing)
  const cleanUpi = (upiId || '').trim();
  const upiCheck = /^[a-z0-9._-]+@[a-zA-Z]{2,64}$/i.test(cleanUpi);
  if (!upiCheck) {
    return { url: null, error: 'Valid UPI ID is required.' };
  }
  if (!isUpiIdAllowed(cleanUpi, allowedUpiIds)) {
    return { url: null, error: 'UPI ID is not in the allowed list.' };
  }

  // 3. Validate Payee Name
  const cleanPayee = (payeeName || '').trim().slice(0, 60);
  if (!cleanPayee) {
    return { url: null, error: 'Payee name is required.' };
  }

  // 4. Resolve and Validate Note
  const note = customNote || (billingMonth ? formatFeeNote(billingMonth) : '');
  const noteRegex = /^Music fees [A-Za-z]{3} \d{4}$/;
  if (!noteRegex.test(note) || note.length > 80) {
    return { url: null, error: 'Note must be in the format "Music fees <Mon YYYY>".' };
  }

  // 5. Resolve and Validate Reference (tr)
  const tr = customTr || generateRandomTr(16);
  const trRegex = /^[A-Z0-9]{12,20}$/;
  if (!trRegex.test(tr)) {
    return { url: null, error: 'Transaction reference must be 12 to 20 uppercase alphanumeric characters.' };
  }

  // 6. Resolve Origin
  const envOrigin = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_PUBLIC_APP_URL : undefined;
  const processOrigin = typeof process !== 'undefined' ? process.env?.VITE_PUBLIC_APP_URL : undefined;
  const rawOrigin = customOrigin || envOrigin || processOrigin || 'https://mix-with-me-classes.vercel.app';
  const cleanOrigin = rawOrigin.trim().replace(/\/+$/, '');

  const amFormatted = amount.toFixed(2);

  const url = `${cleanOrigin}/pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(cleanPayee)}&am=${encodeURIComponent(amFormatted)}&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(tr)}`;

  return { url, error: null };
}

export interface ValidatedPayParams {
  upiId: string;
  payeeName: string;
  amount: string;
  note: string;
  tr: string;
}

/**
 * Validates query parameters on the /pay page.
 * Reads ONLY pa, pn, am, tn, and tr. Ignores all other parameters.
 * Rejects pa if not present in the VITE_ALLOWED_UPI_IDS allowlist (fail-closed).
 */
export function validatePayPageParams(
  params: URLSearchParams | Record<string, string | null | undefined>,
  allowedUpiIds?: string
): { isValid: boolean; error: string | null; data?: ValidatedPayParams } {
  const getParam = (key: string): string => {
    if (params instanceof URLSearchParams) {
      return (params.get(key) || '').trim();
    }
    return ((params && params[key]) || '').trim();
  };

  const pa = getParam('pa');
  const pn = getParam('pn');
  const am = getParam('am');
  const tn = getParam('tn');
  const tr = getParam('tr');

  // Validate pa: valid UPI format AND must match allowlist case-insensitively
  const upiRegex = /^[a-z0-9._-]+@[a-zA-Z]{2,64}$/i;
  if (!pa || !upiRegex.test(pa)) {
    return { isValid: false, error: 'Invalid UPI ID format' };
  }
  if (!isUpiIdAllowed(pa, allowedUpiIds)) {
    return { isValid: false, error: 'UPI ID is not in the allowed list' };
  }

  // Validate am: ^[0-9]+(\.[0-9]{2})?$ with max 100000.00 and > 0
  const amRegex = /^[0-9]+(\.[0-9]{2})?$/;
  if (!am || !amRegex.test(am)) {
    return { isValid: false, error: 'Invalid amount format' };
  }
  const numAm = parseFloat(am);
  if (isNaN(numAm) || numAm <= 0 || numAm > 100000.0) {
    return { isValid: false, error: 'Amount out of valid range' };
  }

  // Validate pn: up to 60 chars, non-empty
  if (!pn || pn.length > 60) {
    return { isValid: false, error: 'Invalid payee name' };
  }

  // Validate tn: up to 80 chars, non-empty
  if (!tn || tn.length > 80) {
    return { isValid: false, error: 'Invalid note' };
  }

  // Validate tr: ^[A-Z0-9]{12,20}$
  const trRegex = /^[A-Z0-9]{12,20}$/;
  if (!tr || !trRegex.test(tr)) {
    return { isValid: false, error: 'Invalid reference format' };
  }

  return {
    isValid: true,
    error: null,
    data: {
      upiId: pa,
      payeeName: pn,
      amount: am,
      note: tn,
      tr,
    },
  };
}

/**
 * Builds the upi://pay launch URI from validated parameters using encodeURIComponent.
 * Guaranteed to start with upi://pay?, containing no unencoded spaces or quotes,
 * and producing no non-UPI redirect.
 */
export function buildUpiAppLaunchUri(params: {
  upiId: string;
  payeeName: string;
  amount: string;
  note: string;
  tr: string;
}): string {
  const cleanPa = encodeURIComponent(params.upiId.trim());
  const cleanPn = encodeURIComponent(params.payeeName.trim().slice(0, 60));
  const cleanAm = encodeURIComponent(params.amount.trim());
  const cleanTn = encodeURIComponent(params.note.trim().slice(0, 80));
  const cleanTr = encodeURIComponent(params.tr.trim());

  return `upi://pay?pa=${cleanPa}&pn=${cleanPn}&am=${cleanAm}&cu=INR&tn=${cleanTn}&tr=${cleanTr}`;
}

/**
 * Builds the WhatsApp payment request message and wa.me link.
 * Places the https link on its own line after "Pay here:".
 * Does NOT put any upi:// link in the message.
 * Keeps UPI ID line and "send the UTR after paying" line.
 */
export function buildPaymentRequestWhatsAppUrl(params: {
  phone: string;
  studentName: string;
  balanceDue: number;
  upiId: string;
  dueDate: string;
  academyName: string;
  paymentUrl?: string | null;
  allowedUpiIds?: string;
}): { url: string | null; message: string; isPhoneValid: boolean } {
  const cleanDigits = cleanIndianPhoneNumber(params.phone);
  const formattedBalance = formatIndianCurrency(params.balanceDue);

  const lines = [
    `Hello, this is a payment request from ${params.academyName}. Balance due for ${params.studentName} is ${formattedBalance}, due by ${params.dueDate}.`,
  ];

  if (params.paymentUrl && isUpiIdAllowed(params.upiId, params.allowedUpiIds)) {
    lines.push(`Pay here:\n${params.paymentUrl}`);
  }

  lines.push(`UPI ID: ${params.upiId}`);
  lines.push('Kindly send the UPI transaction ID (UTR) after payment. Thank you!');

  const message = lines.join('\n');

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
