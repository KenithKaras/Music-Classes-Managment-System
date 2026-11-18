import { describe, it, expect } from 'vitest';
import {
  validateUpiId,
  validateUpiTxnId,
  formatPayeeName,
  buildUpiPayUri,
  generateUpiQrDataUrl,
  cleanIndianPhoneNumber,
  buildPaymentRequestWhatsAppUrl,
} from './upiUtils';
import { calculateFeeBalance, getFeeStatus } from './feeUtils';

describe('UPI Utils - Validators, Encoders & Business Logic', () => {
  describe('UPI ID Validator', () => {
    it('accepts valid UPI IDs with diverse handles and allowed symbols', () => {
      const validIds = [
        'teacher@okhdfcbank',
        'mix.with.me@paytm',
        'music-academy@sbi',
        'academy_fees123@icici',
        'school99@barodampay',
        'test.123-abc_def@axisbank',
      ];
      for (const id of validIds) {
        const res = validateUpiId(id);
        expect(res.isValid, `Expected ${id} to be valid`).toBe(true);
        expect(res.error).toBeNull();
      }
    });

    it('allows empty UPI ID string so UPI can be left unconfigured', () => {
      expect(validateUpiId('').isValid).toBe(true);
      expect(validateUpiId('   ').isValid).toBe(true);
    });

    it('rejects invalid UPI IDs with clear error message', () => {
      const invalidIds = [
        'Teacher@okhdfcbank', // uppercase in local part
        'teacher@', // missing handle
        '@paytm', // missing local part
        'teacher@@paytm', // multiple @
        'teacher paytm', // missing @
        'teacher@a', // handle < 2 chars
        'teacher#123@sbi', // invalid symbol # in local part
        'teacher@123', // handle with digits (NPCI handles are letters)
      ];
      for (const id of invalidIds) {
        const res = validateUpiId(id);
        expect(res.isValid, `Expected ${id} to be invalid`).toBe(false);
        expect(res.error).toBeTruthy();
      }
    });
  });

  describe('UTR (UPI Transaction ID) Validator', () => {
    it('accepts valid 6 to 35 alphanumeric characters and converts to uppercase', () => {
      const validUtrs = [
        { input: '123456', expected: '123456' }, // 6 digits min
        { input: 'upi1234567890', expected: 'UPI1234567890' },
        { input: 'AXIS1234567890ABCDE', expected: 'AXIS1234567890ABCDE' },
        { input: 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R', expected: 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R' }, // 35 chars max
      ];

      for (const { input, expected } of validUtrs) {
        const res = validateUpiTxnId(input);
        expect(res.isValid, `Expected ${input} to be valid`).toBe(true);
        expect(res.formatted).toBe(expected);
        expect(res.error).toBeNull();
      }
    });

    it('rejects empty, too short (<6), too long (>35), or special characters', () => {
      expect(validateUpiTxnId('').isValid).toBe(false);
      expect(validateUpiTxnId('12345').isValid).toBe(false); // only 5 chars
      expect(validateUpiTxnId('123456789012345678901234567890123456').isValid).toBe(false); // 36 chars
      expect(validateUpiTxnId('UTR-123456').isValid).toBe(false); // contains hyphen
      expect(validateUpiTxnId('UTR_123456').isValid).toBe(false); // contains underscore
      expect(validateUpiTxnId('UTR 123456').isValid).toBe(false); // contains space
    });
  });

  describe('Payee Name Trimming and 60-character limit', () => {
    it('trims whitespace and enforces maximum 60 characters', () => {
      const longName = '   MIX with Me Music & Arts Academy Mumbai Maharashtra India Branch South   ';
      const formatted = formatPayeeName(longName, 'Default Academy');
      expect(formatted.length).toBeLessThanOrEqual(60);
      expect(formatted.startsWith(' ')).toBe(false);
      expect(formatted.endsWith(' ')).toBe(false);
    });

    it('defaults to academy name when empty or whitespace', () => {
      expect(formatPayeeName('', 'Symphony School')).toBe('Symphony School');
      expect(formatPayeeName('   ', 'Symphony School')).toBe('Symphony School');
      expect(formatPayeeName(null, 'Symphony School')).toBe('Symphony School');
    });
  });

  describe('UPI Payment URI Builder', () => {
    it('encodes proper NPCI canonical URI without amount', () => {
      const uri = buildUpiPayUri('academy@okhdfcbank', 'MIX with Me Classes');
      expect(uri).toBe('upi://pay?pa=academy%40okhdfcbank&pn=MIX%20with%20Me%20Classes&cu=INR');
      // Must not contain am= (amount parameter)
      expect(uri).not.toContain('&am=');
    });

    it('generates valid QR code data URL', async () => {
      const uri = buildUpiPayUri('academy@sbi', 'Academy');
      const dataUrl = await generateUpiQrDataUrl(uri);
      expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    });
  });

  describe('Balance and Status After Partial and Full Payments', () => {
    it('correctly derives paid, partial, pending status and balance remaining', () => {
      const amountDue = 3000;
      const futureDueDate = '2099-12-31';

      // 0 paid -> pending
      const balance0 = calculateFeeBalance(amountDue, 0);
      const status0 = getFeeStatus(amountDue, 0, futureDueDate);
      expect(balance0).toBe(3000);
      expect(status0).toBe('pending');

      // 1000 paid -> partial
      const balance1 = calculateFeeBalance(amountDue, 1000);
      const status1 = getFeeStatus(amountDue, 1000, futureDueDate);
      expect(balance1).toBe(2000);
      expect(status1).toBe('partial');

      // 3000 paid -> paid
      const balance2 = calculateFeeBalance(amountDue, 3000);
      const status2 = getFeeStatus(amountDue, 3000, futureDueDate);
      expect(balance2).toBe(0);
      expect(status2).toBe('paid');

      // Past due date with remaining balance -> overdue
      const pastDueDate = '2020-01-01';
      const statusOverdue = getFeeStatus(amountDue, 1000, pastDueDate);
      expect(statusOverdue).toBe('overdue');
    });
  });

  describe('Indian Phone Cleaner and WhatsApp Payment Request URL', () => {
    it('cleans 10-digit phone numbers and strips +91 or punctuation', () => {
      expect(cleanIndianPhoneNumber('9876543210')).toBe('9876543210');
      expect(cleanIndianPhoneNumber('+91 98765 43210')).toBe('9876543210');
      expect(cleanIndianPhoneNumber('91-9876543210')).toBe('9876543210');
      expect(cleanIndianPhoneNumber('+919876543210')).toBe('9876543210');
      expect(cleanIndianPhoneNumber('12345')).toBeNull(); // invalid length
      expect(cleanIndianPhoneNumber('5555555555')).toBeNull(); // does not start with 6-9
    });

    it('builds WhatsApp payment request message and wa.me link with required fields', () => {
      const res = buildPaymentRequestWhatsAppUrl({
        phone: '+919876543210',
        studentName: 'Aarav Patel',
        balanceDue: 2500,
        upiId: 'academy@okhdfcbank',
        dueDate: '5 Nov 2026',
        academyName: 'MIX with Me Classes',
      });

      expect(res.isPhoneValid).toBe(true);
      expect(res.url).toContain('https://wa.me/919876543210?text=');
      expect(res.message).toContain('Aarav Patel');
      expect(res.message).toContain('₹2,500');
      expect(res.message).toContain('academy@okhdfcbank');
      expect(res.message).toContain('5 Nov 2026');
      expect(res.message).toContain('MIX with Me Classes');
    });
  });
});
