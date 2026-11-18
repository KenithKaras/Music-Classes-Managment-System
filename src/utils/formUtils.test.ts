import { describe, it, expect } from 'vitest';
import { normalizeIndianPhone, isValidIndianPhone, formatDisplayDate, PHONE_INPUT_HINT } from './formUtils';

describe('formUtils - normalizeIndianPhone', () => {
  it('normalizes 10-digit number starting with 6-9', () => {
    expect(normalizeIndianPhone('9876543210')).toBe('9876543210');
    expect(normalizeIndianPhone('8123456789')).toBe('8123456789');
    expect(normalizeIndianPhone('7000000000')).toBe('7000000000');
    expect(normalizeIndianPhone('6999999999')).toBe('6999999999');
  });

  it('normalizes +91 followed by 10 digits with or without spaces and dashes', () => {
    expect(normalizeIndianPhone('+919876543210')).toBe('9876543210');
    expect(normalizeIndianPhone('+91 9876543210')).toBe('9876543210');
    expect(normalizeIndianPhone('+91-98765-43210')).toBe('9876543210');
    expect(normalizeIndianPhone('91 9876543210')).toBe('9876543210');
    expect(normalizeIndianPhone('09876543210')).toBe('9876543210');
  });

  it('rejects invalid inputs', () => {
    expect(normalizeIndianPhone('12345')).toBe(null);
    expect(normalizeIndianPhone('5555555555')).toBe(null); // Does not start with 6-9
    expect(normalizeIndianPhone('+19876543210')).toBe(null); // US country code
    expect(normalizeIndianPhone('+91 1234567890')).toBe(null); // Starts with 1
    expect(normalizeIndianPhone('')).toBe(null);
    expect(normalizeIndianPhone(null)).toBe(null);
    expect(normalizeIndianPhone(undefined)).toBe(null);
  });

  it('isValidIndianPhone helper works properly', () => {
    expect(isValidIndianPhone('9876543210')).toBe(true);
    expect(isValidIndianPhone('+91 9876543210')).toBe(true);
    expect(isValidIndianPhone('12345')).toBe(false);
  });

  it('exports the standard hint', () => {
    expect(PHONE_INPUT_HINT).toBe('10-digit mobile number. +91 is optional.');
  });
});

describe('formUtils - formatDisplayDate', () => {
  it('formats ISO YYYY-MM-DD correctly to DD MMM YYYY', () => {
    expect(formatDisplayDate('2026-11-18')).toBe('18 Nov 2026');
    expect(formatDisplayDate('2026-01-05')).toBe('5 Jan 2026');
    expect(formatDisplayDate('2026-12-31')).toBe('31 Dec 2026');
  });

  it('formats Date instances correctly', () => {
    const d = new Date(2026, 10, 18);
    expect(formatDisplayDate(d)).toBe('18 Nov 2026');
  });

  it('handles empty or invalid inputs gracefully', () => {
    expect(formatDisplayDate(null)).toBe('—');
    expect(formatDisplayDate(undefined)).toBe('—');
    expect(formatDisplayDate('')).toBe('—');
    expect(formatDisplayDate('invalid-date')).toBe('—');
  });
});
