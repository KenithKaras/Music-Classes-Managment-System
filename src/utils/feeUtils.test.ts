import { describe, it, expect } from 'vitest';
import {
  formatIndianCurrency,
  calculateFeeBalance,
  getFeeStatus,
  calculateDaysOverdue,
  cleanIndianPhoneForWhatsApp,
  buildWhatsAppReminderMessage,
  buildWhatsAppUrl,
  formatBillingMonth,
  getBillingMonthDateString,
} from './feeUtils';

describe('formatIndianCurrency', () => {
  it('formats zero correctly', () => {
    expect(formatIndianCurrency(0)).toBe('₹0');
  });

  it('formats typical monthly fees with Indian grouping', () => {
    expect(formatIndianCurrency(1500)).toBe('₹1,500');
    expect(formatIndianCurrency(25000)).toBe('₹25,000');
    expect(formatIndianCurrency(150000)).toBe('₹1,50,000');
    expect(formatIndianCurrency(10000000)).toBe('₹1,00,00,000');
  });

  it('handles negative, null, and undefined gracefully', () => {
    expect(formatIndianCurrency(-500)).toBe('-₹500');
    expect(formatIndianCurrency(null)).toBe('₹0');
    expect(formatIndianCurrency(undefined)).toBe('₹0');
  });
});

describe('calculateFeeBalance', () => {
  it('calculates remaining balance accurately', () => {
    expect(calculateFeeBalance(1500, 0)).toBe(1500);
    expect(calculateFeeBalance(1500, 500)).toBe(1000);
    expect(calculateFeeBalance(1500, 1500)).toBe(0);
  });

  it('clamps overpayments to 0 balance', () => {
    expect(calculateFeeBalance(1500, 2000)).toBe(0);
  });
});

describe('getFeeStatus', () => {
  const asOf = new Date(2026, 10, 10); // Nov 10, 2026

  it('returns paid when amountPaid >= amountDue', () => {
    expect(getFeeStatus(1500, 1500, '2026-11-05', asOf)).toBe('paid');
    expect(getFeeStatus(1500, 2000, '2026-11-05', asOf)).toBe('paid');
  });

  it('returns overdue when balance remains and past due date', () => {
    // Due date was Nov 5, asOf is Nov 10
    expect(getFeeStatus(1500, 0, '2026-11-05', asOf)).toBe('overdue');
    expect(getFeeStatus(1500, 500, '2026-11-05', asOf)).toBe('overdue');
  });

  it('returns partial when payment made and not yet past due date', () => {
    // Due date is Nov 15, asOf is Nov 10
    expect(getFeeStatus(1500, 500, '2026-11-15', asOf)).toBe('partial');
  });

  it('returns pending when no payment made and not yet past due date', () => {
    // Due date is Nov 15, asOf is Nov 10
    expect(getFeeStatus(1500, 0, '2026-11-15', asOf)).toBe('pending');
  });
});

describe('calculateDaysOverdue', () => {
  it('returns 0 when current date is on or before due date', () => {
    const asOf = new Date(2026, 10, 5); // Nov 5, 2026
    expect(calculateDaysOverdue('2026-11-05', asOf)).toBe(0);
    expect(calculateDaysOverdue('2026-11-10', asOf)).toBe(0);
  });

  it('calculates positive days overdue when past due date', () => {
    const asOf = new Date(2026, 10, 15); // Nov 15, 2026
    expect(calculateDaysOverdue('2026-11-05', asOf)).toBe(10);
  });
});

describe('cleanIndianPhoneForWhatsApp', () => {
  it('cleans 10-digit Indian numbers starting with 6-9', () => {
    expect(cleanIndianPhoneForWhatsApp('9876543210')).toBe('919876543210');
    expect(cleanIndianPhoneForWhatsApp('7890123456')).toBe('917890123456');
  });

  it('strips spaces, dashes, leading 0, and country code', () => {
    expect(cleanIndianPhoneForWhatsApp('+91 98765-43210')).toBe('919876543210');
    expect(cleanIndianPhoneForWhatsApp('098765 43210')).toBe('919876543210');
    expect(cleanIndianPhoneForWhatsApp('919876543210')).toBe('919876543210');
  });

  it('returns null for invalid or non-Indian phone strings', () => {
    expect(cleanIndianPhoneForWhatsApp('12345')).toBe(null);
    expect(cleanIndianPhoneForWhatsApp('5555555555')).toBe(null); // doesn't start with 6-9
    expect(cleanIndianPhoneForWhatsApp('')).toBe(null);
    expect(cleanIndianPhoneForWhatsApp(null)).toBe(null);
  });
});

describe('buildWhatsAppReminderMessage and buildWhatsAppUrl', () => {
  it('builds prefilled reminder message with parent or student name', () => {
    const message = buildWhatsAppReminderMessage({
      studentName: 'Rohan Sharma',
      guardianName: 'Rajesh Sharma',
      balance: 1500,
      monthName: 'November 2026',
      dueDateStr: '2026-11-05',
      academyName: 'MIX with Me Classes',
    });

    expect(message).toContain('Hello Rajesh Sharma');
    expect(message).toContain('MIX with Me Classes');
    expect(message).toContain('₹1,500');
    expect(message).toContain('Rohan Sharma');
    expect(message).toContain('November 2026');
  });

  it('generates proper wa.me link with encoded text', () => {
    const url = buildWhatsAppUrl('919876543210', 'Hello world');
    expect(url).toBe('https://wa.me/919876543210?text=Hello%20world');
  });
});

describe('formatBillingMonth and getBillingMonthDateString', () => {
  it('formats billing month correctly', () => {
    expect(formatBillingMonth('2026-11-01')).toBe('November 2026');
    expect(formatBillingMonth('2027-01-01')).toBe('January 2027');
  });

  it('normalizes date to YYYY-MM-01', () => {
    const date = new Date(2026, 10, 18);
    expect(getBillingMonthDateString(date)).toBe('2026-11-01');
  });
});
