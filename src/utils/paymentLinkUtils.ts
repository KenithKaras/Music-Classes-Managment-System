/**
 * Utility functions for per-academy signed payment links.
 */

/**
 * Converts a byte array to a base64url string without padding.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates a 32-byte cryptographically secure random token, base64url-encoded.
 * Length is exactly 43 characters.
 */
export function generateSignedPaymentToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

/**
 * Validates whether a token matches the expected base64url format and length (40-50 chars).
 */
export function isValidPaymentTokenFormat(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  return /^[A-Za-z0-9_-]{40,50}$/.test(token);
}

/**
 * Computes the SHA-256 hexadecimal hash of a string.
 * Output is exactly 64 lowercase hexadecimal characters.
 */
export async function computeSha256Hex(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Formats an amount in paise (integer) to Rupees string with two decimal places (e.g. 150000 -> "1500.00").
 */
export function formatPaiseToRupeesString(amountPaise: number): string {
  if (typeof amountPaise !== 'number' || isNaN(amountPaise) || amountPaise < 0) {
    return '0.00';
  }
  return (amountPaise / 100).toFixed(2);
}

/**
 * Converts a Rupees amount (number) to integer paise (e.g. 1500 -> 150000).
 */
export function convertRupeesToPaise(rupees: number): number {
  if (typeof rupees !== 'number' || isNaN(rupees) || rupees < 0) {
    return 0;
  }
  return Math.round(rupees * 100);
}

/**
 * Formats a fee note strictly conforming to: "Music fees <Mon YYYY>" (e.g. "Music fees Nov 2026").
 * Maximum length 80 characters. Never includes student name, phone, or ID.
 */
export function formatSignedFeeNote(billingMonthStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = (billingMonthStr || '').split('-');
  if (parts.length >= 2) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12 && /^\d{4}$/.test(year)) {
      return `Music fees ${months[monthIdx]} ${year}`.slice(0, 80);
    }
  }
  return 'Music fees';
}
