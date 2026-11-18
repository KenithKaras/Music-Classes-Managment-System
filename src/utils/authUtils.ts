/**
 * Validates that a password satisfies the strong password rule:
 * At least 8 characters long, containing at least one letter and one number.
 */
export function validatePasswordStrength(password: string): { isValid: boolean; error: string | null } {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      error: 'Password must be at least 8 characters long and contain at least one letter and one number.',
    };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    return {
      isValid: false,
      error: 'Password must be at least 8 characters long and contain at least one letter and one number.',
    };
  }

  return { isValid: true, error: null };
}

/**
 * Maps raw backend / Supabase authentication errors to clean, friendly customer-facing text.
 * Strictly prevents leaking raw JSON, stack traces, or internal error codes.
 */
export function mapAuthError(rawMessage?: string | null): string {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return 'Something went wrong. Please try again.';
  }

  const msg = rawMessage.toLowerCase();

  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('connection refused') ||
    (typeof window !== 'undefined' && window.navigator && window.navigator.onLine === false)
  ) {
    return 'You appear to be offline.';
  }

  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials') ||
    msg.includes('invalid_grant') ||
    msg.includes('invalid password') ||
    msg.includes('wrong password')
  ) {
    return 'Email or password is incorrect.';
  }

  if (msg.includes('email not confirmed')) {
    return 'Please confirm your email address. Check your inbox for the confirmation link.';
  }

  if (
    msg.includes('rate limit') ||
    msg.includes('too many') ||
    msg.includes('429') ||
    msg.includes('over_email_send_rate_limit')
  ) {
    return 'Too many attempts. Try again in a few minutes.';
  }

  if (
    msg.includes('weak password') ||
    msg.includes('password should be') ||
    msg.includes('at least 8 characters')
  ) {
    return 'Password must be at least 8 characters long and contain at least one letter and one number.';
  }

  if (msg.includes('user already registered') || msg.includes('already exists')) {
    return 'An account with this email already exists. Please log in.';
  }

  if (msg.includes('otp_expired') || msg.includes('token has expired') || msg.includes('expired')) {
    return 'This link has expired. Please request a new one.';
  }

  return 'Something went wrong. Please try again.';
}
