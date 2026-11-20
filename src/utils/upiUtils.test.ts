import { describe, it, expect } from 'vitest';
import {
  validateUpiId,
  validateUpiTxnId,
  formatPayeeName,
  buildUpiPayUri,
  generateUpiQrDataUrl,
  dataUrlToBlob,
  cleanIndianPhoneNumber,
  buildPaymentRequestWhatsAppUrl,
  generateRandomTr,
  formatFeeNote,
  buildHttpsPaymentUrl,
  validatePayPageParams,
  buildUpiAppLaunchUri,
  getAllowedUpiIds,
  isUpiIdAllowed,
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

    it('accepts empty string and whitespace as valid because UTR is optional', () => {
      const emptyRes = validateUpiTxnId('');
      expect(emptyRes.isValid).toBe(true);
      expect(emptyRes.error).toBeNull();
      expect(emptyRes.formatted).toBe('');

      const wsRes = validateUpiTxnId('   ');
      expect(wsRes.isValid).toBe(true);
      expect(wsRes.error).toBeNull();
      expect(wsRes.formatted).toBe('');
    });

    it('rejects too short (<6), too long (>35), or special characters', () => {
      expect(validateUpiTxnId('12345').isValid).toBe(false); // only 5 chars
      expect(validateUpiTxnId('123456789012345678901234567890123456').isValid).toBe(false); // 36 chars
      expect(validateUpiTxnId('UTR-123456').isValid).toBe(false); // contains hyphen
      expect(validateUpiTxnId('UTR_123456').isValid).toBe(false); // contains underscore
      expect(validateUpiTxnId('UTR 123456').isValid).toBe(false); // contains space
      expect(validateUpiTxnId('UTR@123').isValid).toBe(false); // contains @ symbol
      expect(validateUpiTxnId('UTR#12345').isValid).toBe(false); // contains # symbol
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
        paymentUrl: 'https://mix-with-me-classes.vercel.app/pay?pa=academy%40okhdfcbank&pn=MIX%20with%20Me%20Classes&am=2500.00&tn=Music%20fees%20Nov%202026&tr=ABCD1234EFGH5678',
      });

      expect(res.isPhoneValid).toBe(true);
      expect(res.url).toContain('https://wa.me/919876543210?text=');
      expect(res.message).toContain('Aarav Patel');
      expect(res.message).toContain('₹2,500');
      expect(res.message).toContain('Pay here:\nhttps://mix-with-me-classes.vercel.app/pay?');
      expect(res.message).toContain('UPI ID: academy@okhdfcbank');
      expect(res.message).toContain('Kindly send the UPI transaction ID (UTR) after payment. Thank you!');
      expect(res.message).not.toContain('upi://');
    });

    it('for an allowlisted UPI ID, WhatsApp message contains both https link and Pay here: line', () => {
      const res = buildPaymentRequestWhatsAppUrl({
        phone: '9876543210',
        studentName: 'Aarav Patel',
        balanceDue: 2500,
        upiId: 'academy@okhdfcbank',
        dueDate: '5 Nov 2026',
        academyName: 'MIX with Me Classes',
        paymentUrl: 'https://mix-with-me-classes.vercel.app/pay?pa=academy%40okhdfcbank&pn=MIX%20with%20Me%20Classes&am=2500.00&tn=Music%20fees%20Nov%202026&tr=ABCD1234EFGH5678',
        allowedUpiIds: 'academy@okhdfcbank',
      });

      expect(res.message).toContain('Pay here:');
      expect(res.message).toContain('https://mix-with-me-classes.vercel.app/pay?');
      expect(res.message).toContain('UPI ID: academy@okhdfcbank');
      expect(res.message).toContain('Kindly send the UPI transaction ID (UTR) after payment. Thank you!');
    });

    it('for a non-allowlisted UPI ID, WhatsApp message contains no https link and no Pay here: line', () => {
      const res = buildPaymentRequestWhatsAppUrl({
        phone: '9876543210',
        studentName: 'Aarav Patel',
        balanceDue: 2500,
        upiId: 'attacker@okhdfcbank',
        dueDate: '5 Nov 2026',
        academyName: 'MIX with Me Classes',
        paymentUrl: 'https://mix-with-me-classes.vercel.app/pay?pa=attacker%40okhdfcbank&pn=MIX%20with%20Me%20Classes&am=2500.00&tn=Music%20fees%20Nov%202026&tr=ABCD1234EFGH5678',
        allowedUpiIds: 'academy@okhdfcbank',
      });

      expect(res.message).not.toContain('Pay here:');
      expect(res.message).not.toContain('https://');
      expect(res.message).toContain('UPI ID: attacker@okhdfcbank');
      expect(res.message).toContain('Kindly send the UPI transaction ID (UTR) after payment. Thank you!');
    });
  });

  describe('dataUrlToBlob - Direct In-Memory Base64 to Blob Converter (No CSP connect-src violation)', () => {
    it('returns a Blob with the correct mime type and byte length from a standard data URL', () => {
      // 5 bytes: 'hello' encoded in base64 is 'aGVsbG8='
      const dataUrl = 'data:image/png;base64,aGVsbG8=';
      const blob = dataUrlToBlob(dataUrl);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBe(5);
    });

    it('correctly handles actual QR code data URLs without network fetch', async () => {
      const uri = 'upi://pay?pa=test@okaxis&pn=Test&cu=INR';
      const qrDataUrl = await generateUpiQrDataUrl(uri);
      const blob = dataUrlToBlob(qrDataUrl);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBeGreaterThan(100);
    });

    it('extracts custom mime type from header and falls back if missing', () => {
      const jpegDataUrl = 'data:image/jpeg;base64,dGVzdA=='; // 4 bytes: 'test'
      const blobJpeg = dataUrlToBlob(jpegDataUrl);
      expect(blobJpeg.type).toBe('image/jpeg');
      expect(blobJpeg.size).toBe(4);

      const rawBase64 = 'dGVzdA==';
      const blobRaw = dataUrlToBlob(rawBase64, 'image/png');
      expect(blobRaw.type).toBe('image/png');
      expect(blobRaw.size).toBe(4);
    });
  });

  describe('Random Transaction Reference (tr) Generator', () => {
    it('generates random uppercase alphanumeric strings between 12 and 20 chars', () => {
      const tr1 = generateRandomTr(16);
      const tr2 = generateRandomTr(16);

      expect(tr1).toHaveLength(16);
      expect(tr2).toHaveLength(16);
      expect(tr1).not.toBe(tr2); // randomness
      expect(/^[A-Z0-9]{16}$/.test(tr1)).toBe(true);
      expect(/^[A-Z0-9]{16}$/.test(tr2)).toBe(true);

      const minTr = generateRandomTr(12);
      expect(minTr).toHaveLength(12);
      expect(/^[A-Z0-9]{12}$/.test(minTr)).toBe(true);

      const maxTr = generateRandomTr(20);
      expect(maxTr).toHaveLength(20);
      expect(/^[A-Z0-9]{20}$/.test(maxTr)).toBe(true);
    });
  });

  describe('Fee Note Formatter', () => {
    it('strictly formats billing month into "Music fees <Mon YYYY>" without student info', () => {
      expect(formatFeeNote('2026-11-01')).toBe('Music fees Nov 2026');
      expect(formatFeeNote('2026-01-15')).toBe('Music fees Jan 2026');
      expect(formatFeeNote('2027-08-01')).toBe('Music fees Aug 2027');
    });

    it('falls back safely for invalid inputs', () => {
      expect(formatFeeNote('')).toBe('Music fees');
      expect(formatFeeNote('invalid-date')).toBe('Music fees');
    });
  });

  describe('UPI Allowlist Verification (Phishing Prevention)', () => {
    const mockAllowlist = 'academy@okhdfcbank,backup@okaxis';

    it('an allowed UPI ID builds a link successfully', () => {
      expect(getAllowedUpiIds(mockAllowlist)).toEqual(['academy@okhdfcbank', 'backup@okaxis']);
      expect(isUpiIdAllowed('academy@okhdfcbank', mockAllowlist)).toBe(true);
      const res = buildHttpsPaymentUrl({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: 1500,
        billingMonth: '2026-11-01',
        allowedUpiIds: mockAllowlist,
      });
      expect(res.error).toBeNull();
      expect(res.url).toContain('pa=academy%40okhdfcbank');
    });

    it('a non-allowed UPI ID is refused by buildHttpsPaymentUrl', () => {
      expect(isUpiIdAllowed('attacker@okhdfcbank', mockAllowlist)).toBe(false);
      const res = buildHttpsPaymentUrl({
        upiId: 'attacker@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: 1500,
        billingMonth: '2026-11-01',
        allowedUpiIds: mockAllowlist,
      });
      expect(res.url).toBeNull();
      expect(res.error).toBe('UPI ID is not in the allowed list.');
    });

    it('a non-allowed UPI ID is refused by validatePayPageParams', () => {
      const res = validatePayPageParams(
        {
          pa: 'attacker@okhdfcbank',
          pn: 'MIX with Me Classes',
          am: '1500.00',
          tn: 'Music fees Nov 2026',
          tr: 'ABC123DEF4567890',
        },
        mockAllowlist
      );
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('UPI ID is not in the allowed list');
    });

    it('an empty allowlist refuses everything (fail-closed)', () => {
      // Empty string
      const resEmpty = buildHttpsPaymentUrl({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: 1500,
        billingMonth: '2026-11-01',
        allowedUpiIds: '',
      });
      expect(resEmpty.url).toBeNull();
      expect(resEmpty.error).toBe('UPI ID is not in the allowed list.');

      // Whitespace only
      const resSpaces = buildHttpsPaymentUrl({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: 1500,
        billingMonth: '2026-11-01',
        allowedUpiIds: '   ',
      });
      expect(resSpaces.url).toBeNull();
      expect(resSpaces.error).toBe('UPI ID is not in the allowed list.');

      // Validator fail-closed
      const valRes = validatePayPageParams(
        {
          pa: 'academy@okhdfcbank',
          pn: 'MIX with Me Classes',
          am: '1500.00',
          tn: 'Music fees Nov 2026',
          tr: 'ABC123DEF4567890',
        },
        ''
      );
      expect(valRes.isValid).toBe(false);
    });

    it('matching is case-insensitive, exact match only', () => {
      // Uppercase input matches lowercase allowlist
      const resUpper = buildHttpsPaymentUrl({
        upiId: 'ACADEMY@OKHDFCBANK',
        payeeName: 'MIX with Me Classes',
        amount: 1500,
        billingMonth: '2026-11-01',
        allowedUpiIds: 'academy@okhdfcbank',
      });
      expect(resUpper.error).toBeNull();
      expect(resUpper.url).toBeTruthy();

      // Lowercase input matches mixed-case allowlist
      const resMixed = buildHttpsPaymentUrl({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: 1500,
        billingMonth: '2026-11-01',
        allowedUpiIds: 'Academy@OkHdfcBank',
      });
      expect(resMixed.error).toBeNull();
      expect(resMixed.url).toBeTruthy();

      // Exact match only: substring/prefix does not match
      const resSubstring = buildHttpsPaymentUrl({
        upiId: 'sub.academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: 1500,
        billingMonth: '2026-11-01',
        allowedUpiIds: 'academy@okhdfcbank',
      });
      expect(resSubstring.url).toBeNull();
      expect(resSubstring.error).toBe('UPI ID is not in the allowed list.');
    });
  });

  describe('HTTPS Payment URL Builder (buildHttpsPaymentUrl)', () => {
    it('builds a fully-encoded https payment URL with exactly two decimal amount', () => {
      const res = buildHttpsPaymentUrl({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: 1500,
        billingMonth: '2026-11-01',
        tr: 'REF1234567890ABC',
        origin: 'https://mix-with-me-classes.vercel.app',
        allowedUpiIds: 'academy@okhdfcbank',
      });

      expect(res.error).toBeNull();
      expect(res.url).toBe(
        'https://mix-with-me-classes.vercel.app/pay?pa=academy%40okhdfcbank&pn=MIX%20with%20Me%20Classes&am=1500.00&tn=Music%20fees%20Nov%202026&tr=REF1234567890ABC'
      );
    });

    it('formats decimal amounts with two decimal places', () => {
      const res = buildHttpsPaymentUrl({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: 1750.5,
        billingMonth: '2026-11-01',
        tr: 'REF1234567890ABC',
        allowedUpiIds: 'academy@okhdfcbank',
      });

      expect(res.error).toBeNull();
      expect(res.url).toContain('&am=1750.50&');
    });

    it('rejects balance <= 0 (e.g. 0 or negative)', () => {
      const res0 = buildHttpsPaymentUrl({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: 0,
        billingMonth: '2026-11-01',
        allowedUpiIds: 'academy@okhdfcbank',
      });
      expect(res0.url).toBeNull();
      expect(res0.error).toBeTruthy();

      const resNeg = buildHttpsPaymentUrl({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: -500,
        billingMonth: '2026-11-01',
        allowedUpiIds: 'academy@okhdfcbank',
      });
      expect(resNeg.url).toBeNull();
      expect(resNeg.error).toBeTruthy();
    });

    it('rejects amount > 100,000.00', () => {
      const res = buildHttpsPaymentUrl({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: 100000.01,
        billingMonth: '2026-11-01',
        allowedUpiIds: 'academy@okhdfcbank',
      });
      expect(res.url).toBeNull();
      expect(res.error).toBeTruthy();
    });

    it('rejects invalid or missing UPI ID', () => {
      const resEmpty = buildHttpsPaymentUrl({
        upiId: '',
        payeeName: 'MIX with Me Classes',
        amount: 1500,
        billingMonth: '2026-11-01',
        allowedUpiIds: 'academy@okhdfcbank',
      });
      expect(resEmpty.url).toBeNull();
      expect(resEmpty.error).toBeTruthy();

      const resEvil = buildHttpsPaymentUrl({
        upiId: 'http://evil.com',
        payeeName: 'MIX with Me Classes',
        amount: 1500,
        billingMonth: '2026-11-01',
        allowedUpiIds: 'academy@okhdfcbank',
      });
      expect(resEvil.url).toBeNull();
      expect(resEvil.error).toBeTruthy();
    });

    it('rejects invalid note format', () => {
      const res = buildHttpsPaymentUrl({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: 1500,
        note: 'Student fee for Aarav Patel', // Contains student name!
        allowedUpiIds: 'academy@okhdfcbank',
      });
      expect(res.url).toBeNull();
      expect(res.error).toBeTruthy();
    });

    it('rejects invalid transaction reference (tr)', () => {
      const resShort = buildHttpsPaymentUrl({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: 1500,
        billingMonth: '2026-11-01',
        tr: 'TOO_SHORT', // < 12 chars
        allowedUpiIds: 'academy@okhdfcbank',
      });
      expect(resShort.url).toBeNull();
      expect(resShort.error).toBeTruthy();

      const resSpecial = buildHttpsPaymentUrl({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: 1500,
        billingMonth: '2026-11-01',
        tr: 'INVALID-TR-CHARS!',
        allowedUpiIds: 'academy@okhdfcbank',
      });
      expect(resSpecial.url).toBeNull();
      expect(resSpecial.error).toBeTruthy();
    });
  });

  describe('Payment Page Parameter Validator (validatePayPageParams)', () => {
    it('accepts valid parameters and ignores extra unallowed parameters', () => {
      const params = new URLSearchParams(
        'pa=academy@okhdfcbank&pn=MIX%20with%20Me%20Classes&am=1500.00&tn=Music%20fees%20Nov%202026&tr=ABC123DEF4567890&student_id=999&phone=9876543210'
      );
      const res = validatePayPageParams(params, 'academy@okhdfcbank');

      expect(res.isValid).toBe(true);
      expect(res.error).toBeNull();
      expect(res.data).toEqual({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me Classes',
        amount: '1500.00',
        note: 'Music fees Nov 2026',
        tr: 'ABC123DEF4567890',
      });
      // Extra params like student_id or phone must be ignored
      expect((res.data as any).student_id).toBeUndefined();
      expect((res.data as any).phone).toBeUndefined();
    });

    it('rejects invalid UPI ID (pa)', () => {
      expect(validatePayPageParams({ pa: 'http://evil', pn: 'Academy', am: '100.00', tn: 'Music fees Nov 2026', tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
      expect(validatePayPageParams({ pa: 'javascript:alert(1)', pn: 'Academy', am: '100.00', tn: 'Music fees Nov 2026', tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
      expect(validatePayPageParams({ pa: '', pn: 'Academy', am: '100.00', tn: 'Music fees Nov 2026', tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
      expect(validatePayPageParams({ pa: 'teacher@', pn: 'Academy', am: '100.00', tn: 'Music fees Nov 2026', tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
    });

    it('rejects invalid amount (am)', () => {
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: 'Academy', am: '0', tn: 'Note', tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: 'Academy', am: '0.00', tn: 'Note', tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: 'Academy', am: '-10.00', tn: 'Note', tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: 'Academy', am: '100000.01', tn: 'Note', tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: 'Academy', am: '1500.123', tn: 'Note', tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: 'Academy', am: 'abc', tn: 'Note', tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
    });

    it('rejects invalid payee name (pn) or note (tn)', () => {
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: '', am: '100.00', tn: 'Note', tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: 'A'.repeat(61), am: '100.00', tn: 'Note', tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: 'Academy', am: '100.00', tn: '', tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: 'Academy', am: '100.00', tn: 'A'.repeat(81), tr: 'ABC123DEF4567890' }, 'academy@sbi').isValid).toBe(false);
    });

    it('rejects invalid transaction reference (tr)', () => {
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: 'Academy', am: '100.00', tn: 'Note', tr: 'ABC' }, 'academy@sbi').isValid).toBe(false); // too short
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: 'Academy', am: '100.00', tn: 'Note', tr: 'A'.repeat(21) }, 'academy@sbi').isValid).toBe(false); // too long
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: 'Academy', am: '100.00', tn: 'Note', tr: 'abc123def4567890' }, 'academy@sbi').isValid).toBe(false); // lowercase
      expect(validatePayPageParams({ pa: 'academy@sbi', pn: 'Academy', am: '100.00', tn: 'Note', tr: 'ABC_123-DEF_4567' }, 'academy@sbi').isValid).toBe(false); // special symbols
    });
  });

  describe('UPI App Launch URI Builder (buildUpiAppLaunchUri)', () => {
    it('builds canonical upi:// URL containing no unencoded spaces or quotes', () => {
      const uri = buildUpiAppLaunchUri({
        upiId: 'academy@okhdfcbank',
        payeeName: 'MIX with Me "Classes"',
        amount: '1500.00',
        note: 'Music fees Nov 2026',
        tr: 'REF1234567890ABC',
      });

      expect(uri.startsWith('upi://pay?')).toBe(true);
      expect(uri).not.toContain(' ');
      expect(uri).not.toContain('"');
      expect(uri).not.toContain("'");
      expect(uri).toContain('pa=academy%40okhdfcbank');
      expect(uri).toContain('pn=MIX%20with%20Me%20%22Classes%22');
      expect(uri).toContain('am=1500.00');
      expect(uri).toContain('cu=INR');
      expect(uri).toContain('tn=Music%20fees%20Nov%202026');
      expect(uri).toContain('tr=REF1234567890ABC');
    });

    it('strictly prevents redirect to non-UPI schemes', () => {
      const testCases = [
        'javascript:alert(1)',
        'http://attacker.com',
        'https://malicious.org',
        'data:text/html,<h1>evil</h1>',
      ];

      for (const evil of testCases) {
        // 1. Validator rejects it on /pay page
        const validation = validatePayPageParams({
          pa: evil,
          pn: 'Academy',
          am: '100.00',
          tn: 'Note',
          tr: 'ABC123DEF4567890',
        });
        expect(validation.isValid).toBe(false);

        // 2. Even if passed to builder, resulting URI always begins with upi://pay?
        const built = buildUpiAppLaunchUri({
          upiId: evil,
          payeeName: 'Academy',
          amount: '100.00',
          note: 'Note',
          tr: 'ABC123DEF4567890',
        });
        expect(built.startsWith('upi://pay?')).toBe(true);
        expect(built.startsWith('javascript:')).toBe(false);
        expect(built.startsWith('http:')).toBe(false);
        expect(built.startsWith('https:')).toBe(false);
      }
    });
  });
});
