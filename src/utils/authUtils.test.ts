import { describe, it, expect } from 'vitest';
import { validatePasswordStrength, mapAuthError } from './authUtils';

describe('authUtils - validatePasswordStrength', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePasswordStrength('Pass1').isValid).toBe(false);
    expect(validatePasswordStrength('Pass1').error).toContain('at least 8 characters');
  });

  it('rejects passwords with only letters', () => {
    expect(validatePasswordStrength('PasswordOnly').isValid).toBe(false);
    expect(validatePasswordStrength('PasswordOnly').error).toContain('one letter and one number');
  });

  it('rejects passwords with only numbers', () => {
    expect(validatePasswordStrength('1234567890').isValid).toBe(false);
    expect(validatePasswordStrength('1234567890').error).toContain('one letter and one number');
  });

  it('accepts valid passwords with at least 8 characters, letters and numbers', () => {
    expect(validatePasswordStrength('Secret123').isValid).toBe(true);
    expect(validatePasswordStrength('Secret123').error).toBeNull();
    expect(validatePasswordStrength('MusicAcademy2026!').isValid).toBe(true);
  });
});

describe('authUtils - mapAuthError', () => {
  it('maps invalid credentials errors', () => {
    expect(mapAuthError('Invalid login credentials')).toBe('Email or password is incorrect.');
    expect(mapAuthError('invalid_grant')).toBe('Email or password is incorrect.');
    expect(mapAuthError('Invalid password')).toBe('Email or password is incorrect.');
  });

  it('maps email unconfirmed error', () => {
    expect(mapAuthError('Email not confirmed')).toBe(
      'Please confirm your email address. Check your inbox for the confirmation link.'
    );
  });

  it('maps rate limit error', () => {
    expect(mapAuthError('Rate limit exceeded: 429')).toBe(
      'Too many attempts. Try again in a few minutes.'
    );
  });

  it('maps weak password error', () => {
    expect(mapAuthError('Weak password: Password should be at least 8 characters')).toBe(
      'Password must be at least 8 characters long and contain at least one letter and one number.'
    );
  });

  it('maps network errors to offline message', () => {
    expect(mapAuthError('Failed to fetch')).toBe('You appear to be offline.');
    expect(mapAuthError('NetworkError when attempting to fetch resource')).toBe('You appear to be offline.');
  });

  it('maps unknown errors to generic safe message without leaking internal details', () => {
    expect(mapAuthError('Postgres error code 42P01 in table auth.users')).toBe(
      'Something went wrong. Please try again.'
    );
    expect(mapAuthError('')).toBe('Something went wrong. Please try again.');
  });
});
