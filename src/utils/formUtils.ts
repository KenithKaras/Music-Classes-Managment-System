/**
 * Normalizes an Indian phone number string to a 10-digit number.
 * Accepts either:
 * - 10 digits (e.g. "9876543210")
 * - +91 followed by 10 digits (e.g. "+91 9876543210", "+919876543210")
 * - 0 followed by 10 digits (e.g. "09876543210")
 *
 * Strips whitespace, dashes, and country code, validating the remaining 10 digits start with 6-9.
 * Returns the normalized 10-digit string on success, or null on invalid.
 */
export function normalizeIndianPhone(input: string | null | undefined): string | null {
  if (!input) return null;

  // Remove spaces, hyphens, parentheses, and tabs
  const cleaned = input.trim().replace(/[\s\-()]/g, '');
  if (!cleaned) return null;

  // Check pattern: optional +91, 91, or 0 followed by 10 digits starting with 6-9
  const match = cleaned.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  if (match) {
    return match[1];
  }

  return null;
}

export function isValidIndianPhone(input: string | null | undefined): boolean {
  return normalizeIndianPhone(input) !== null;
}

export const PHONE_INPUT_HINT = '10-digit mobile number. +91 is optional.';

/**
 * Formats an ISO date string (YYYY-MM-DD or full timestamp) as DD MMM YYYY (e.g. "18 Nov 2026").
 */
export function formatDisplayDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';

  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'string') {
    // If YYYY-MM-DD, parse year, month, day directly to avoid UTC timezone off-by-one
    const parts = dateInput.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      d = new Date(year, month, day);
    } else {
      d = new Date(dateInput);
    }
  } else {
    return '—';
  }

  if (isNaN(d.getTime())) return '—';

  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = months[d.getMonth()];
  const year = d.getFullYear();

  return `${day} ${monthStr} ${year}`;
}

/**
 * Formats a 24-hour time string ("14:00" or "14:00:00") into 12-hour format with AM/PM (e.g. "02:00 PM").
 */
export function formatDisplayTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '—';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].slice(0, 2);
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;
  return `${formattedHours}:${minutes} ${ampm}`;
}
