import { describe, it, expect } from 'vitest';
import {
  isValidIndianMobilePhone,
  isValidEnrollmentToken,
  validateEnrollmentForm,
  isEnrollmentLinkFull,
  type EnrollmentFormData,
} from './enrollmentUtils';

describe('enrollmentUtils - Validation & Business Logic', () => {
  describe('isValidIndianMobilePhone', () => {
    it('accepts valid 10-digit mobile numbers starting with 6, 7, 8, 9', () => {
      expect(isValidIndianMobilePhone('9876543210')).toBe(true);
      expect(isValidIndianMobilePhone('8765432109')).toBe(true);
      expect(isValidIndianMobilePhone('7654321098')).toBe(true);
      expect(isValidIndianMobilePhone('6543210987')).toBe(true);
    });

    it('rejects numbers starting with 0-5', () => {
      expect(isValidIndianMobilePhone('5876543210')).toBe(false);
      expect(isValidIndianMobilePhone('1234567890')).toBe(false);
      expect(isValidIndianMobilePhone('0987654321')).toBe(false);
    });

    it('rejects numbers with fewer or more than 10 digits', () => {
      expect(isValidIndianMobilePhone('987654321')).toBe(false); // 9 digits
      expect(isValidIndianMobilePhone('98765432100')).toBe(false); // 11 digits
      expect(isValidIndianMobilePhone('')).toBe(false);
    });

    it('handles formatted strings with spaces or dashes by extracting digits', () => {
      expect(isValidIndianMobilePhone('98765-43210')).toBe(true);
      expect(isValidIndianMobilePhone('98765 43210')).toBe(true);
    });
  });

  describe('isValidEnrollmentToken', () => {
    it('accepts valid 43-character base64url tokens', () => {
      const token = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP1';
      expect(isValidEnrollmentToken(token)).toBe(true);
    });

    it('rejects tokens that are too short, too long, or contain invalid characters', () => {
      expect(isValidEnrollmentToken('short_token')).toBe(false);
      expect(isValidEnrollmentToken('a'.repeat(60))).toBe(false);
      expect(isValidEnrollmentToken('invalid+token/with=special$chars!1234567890')).toBe(false);
      expect(isValidEnrollmentToken('')).toBe(false);
    });
  });

  describe('validateEnrollmentForm', () => {
    const validForm: EnrollmentFormData = {
      child_name: 'Aarav Sharma',
      parent_name: 'Rohan Sharma',
      parent_phone: '9876543210',
      parent_email: 'rohan.sharma@example.com',
      address: '123 MG Road, Bengaluru',
      preferred_batch: 'Weekend Keyboard',
      consent: true,
    };

    it('validates a complete, valid registration form', () => {
      const res = validateEnrollmentForm(validForm);
      expect(res.isValid).toBe(true);
      expect(Object.keys(res.errors)).toHaveLength(0);
    });

    it('enforces consent required (false fails validation)', () => {
      const res = validateEnrollmentForm({ ...validForm, consent: false });
      expect(res.isValid).toBe(false);
      expect(res.errors.consent).toContain('Consent is required');
    });

    it('enforces child_name and parent_name length limits (2 to 80 chars)', () => {
      expect(validateEnrollmentForm({ ...validForm, child_name: 'A' }).isValid).toBe(false);
      expect(validateEnrollmentForm({ ...validForm, child_name: 'A'.repeat(81) }).isValid).toBe(false);
      expect(validateEnrollmentForm({ ...validForm, parent_name: 'P' }).isValid).toBe(false);
      expect(validateEnrollmentForm({ ...validForm, parent_name: 'P'.repeat(81) }).isValid).toBe(false);
    });

    it('enforces address (max 300) and preferred_batch (max 60) limits', () => {
      expect(validateEnrollmentForm({ ...validForm, address: 'X'.repeat(301) }).isValid).toBe(false);
      expect(validateEnrollmentForm({ ...validForm, preferred_batch: 'Y'.repeat(61) }).isValid).toBe(false);
    });
  });

  describe('isEnrollmentLinkFull', () => {
    it('returns true when submissions_count reaches or exceeds max_submissions', () => {
      expect(isEnrollmentLinkFull(5, 5)).toBe(true);
      expect(isEnrollmentLinkFull(6, 5)).toBe(true);
    });

    it('returns false when submissions_count is strictly less than max_submissions', () => {
      expect(isEnrollmentLinkFull(4, 5)).toBe(false);
      expect(isEnrollmentLinkFull(0, 5)).toBe(false);
    });
  });
});
