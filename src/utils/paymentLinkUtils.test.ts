import { describe, it, expect } from 'vitest';
import {
  generateSignedPaymentToken,
  isValidPaymentTokenFormat,
  computeSha256Hex,
  formatPaiseToRupeesString,
  convertRupeesToPaise,
  formatSignedFeeNote,
  bytesToBase64Url,
} from './paymentLinkUtils';

describe('Signed Payment Link Utils (Part 2)', () => {
  describe('Token Generation, Length, and Base64url Characters', () => {
    it('generates a token of exactly 43 characters from 32 random bytes', () => {
      const token = generateSignedPaymentToken();
      expect(token).toHaveLength(43);
      // Base64url characters: A-Z, a-z, 0-9, -, _ with no padding (=)
      expect(/^[A-Za-z0-9_-]{43}$/.test(token)).toBe(true);
      expect(token).not.toContain('+');
      expect(token).not.toContain('/');
      expect(token).not.toContain('=');
    });

    it('validates correct and incorrect token formats and lengths', () => {
      const validToken = generateSignedPaymentToken();
      expect(isValidPaymentTokenFormat(validToken)).toBe(true);

      // Null, undefined, empty
      expect(isValidPaymentTokenFormat(null)).toBe(false);
      expect(isValidPaymentTokenFormat(undefined)).toBe(false);
      expect(isValidPaymentTokenFormat('')).toBe(false);

      // Too short (< 40) or too long (> 50)
      expect(isValidPaymentTokenFormat('short_token_12345')).toBe(false);
      expect(isValidPaymentTokenFormat('a'.repeat(60))).toBe(false);

      // Invalid characters (+, /, =, spaces, special symbols)
      expect(isValidPaymentTokenFormat(validToken.slice(0, 42) + '+')).toBe(false);
      expect(isValidPaymentTokenFormat(validToken.slice(0, 42) + '/')).toBe(false);
      expect(isValidPaymentTokenFormat(validToken.slice(0, 42) + '=')).toBe(false);
      expect(isValidPaymentTokenFormat(validToken.slice(0, 42) + '$')).toBe(false);
      expect(isValidPaymentTokenFormat(validToken.slice(0, 42) + ' ')).toBe(false);
    });

    it('bytesToBase64Url correctly converts arbitrary byte arrays', () => {
      // 0 bytes
      expect(bytesToBase64Url(new Uint8Array(0))).toBe('');
      // Test known vector: 'hello' (ascii: 104, 101, 108, 108, 111) -> 'aGVsbG8'
      const helloBytes = new Uint8Array([104, 101, 108, 108, 111]);
      expect(bytesToBase64Url(helloBytes)).toBe('aGVsbG8');
    });
  });

  describe('SHA-256 Hash Output Format', () => {
    it('produces exactly 64 lowercase hexadecimal characters', async () => {
      const token = generateSignedPaymentToken();
      const hash = await computeSha256Hex(token);
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });

    it('is deterministic for the same token input', async () => {
      const token = 'test_token_1234567890abcdefghijklmnopqrstuv';
      const hash1 = await computeSha256Hex(token);
      const hash2 = await computeSha256Hex(token);
      expect(hash1).toBe(hash2);
      expect(/^[0-9a-f]{64}$/.test(hash1)).toBe(true);
    });

    it('produces known SHA-256 vector correctly', async () => {
      // SHA-256 of empty string is e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      const emptyHash = await computeSha256Hex('');
      expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
  });

  describe('Amount Formatting and Conversion (Paise <-> Rupees)', () => {
    it('formats paise integers to two-decimal Rupees string format', () => {
      expect(formatPaiseToRupeesString(150000)).toBe('1500.00');
      expect(formatPaiseToRupeesString(250050)).toBe('2500.50');
      expect(formatPaiseToRupeesString(100)).toBe('1.00');
      expect(formatPaiseToRupeesString(99)).toBe('0.99');
      expect(formatPaiseToRupeesString(5)).toBe('0.05');
      expect(formatPaiseToRupeesString(0)).toBe('0.00');
    });

    it('safely handles invalid amounts with 0.00 fallback', () => {
      expect(formatPaiseToRupeesString(-500)).toBe('0.00');
      expect(formatPaiseToRupeesString(NaN)).toBe('0.00');
    });

    it('converts Rupees to integer paise properly', () => {
      expect(convertRupeesToPaise(1500)).toBe(150000);
      expect(convertRupeesToPaise(2500.50)).toBe(250050);
      expect(convertRupeesToPaise(0)).toBe(0);
      expect(convertRupeesToPaise(-10)).toBe(0);
    });
  });

  describe('Note Format (Privacy & Conformance)', () => {
    it('strictly formats billing month into "Music fees <Mon YYYY>"', () => {
      expect(formatSignedFeeNote('2026-11-01')).toBe('Music fees Nov 2026');
      expect(formatSignedFeeNote('2027-01-15')).toBe('Music fees Jan 2027');
      expect(formatSignedFeeNote('2025-08-01')).toBe('Music fees Aug 2025');
    });

    it('falls back safely for malformed dates', () => {
      expect(formatSignedFeeNote('')).toBe('Music fees');
      expect(formatSignedFeeNote('invalid-date')).toBe('Music fees');
    });

    it('never contains student PII and stays under 80 characters', () => {
      const note = formatSignedFeeNote('2026-11-01');
      expect(note.length).toBeLessThanOrEqual(80);
      expect(note.toLowerCase()).not.toContain('student');
      expect(note.toLowerCase()).not.toContain('id');
      expect(note.toLowerCase()).not.toContain('phone');
    });
  });
});
