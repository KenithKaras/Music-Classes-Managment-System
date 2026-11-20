/**
 * Student enrollment validation utilities.
 * Enforces phone formatting, name lengths, token validity, and consent.
 */

export interface EnrollmentFormData {
  child_name: string;
  parent_name: string;
  parent_phone: string;
  parent_email?: string;
  address?: string;
  preferred_batch?: string;
  consent: boolean;
}

/**
 * Validates Indian mobile numbers: exactly 10 digits, starting with 6, 7, 8, or 9.
 */
export function isValidIndianMobilePhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(digits);
}

/**
 * Validates token string format (base64url, 40 to 50 characters).
 */
export function isValidEnrollmentToken(token: string): boolean {
  if (!token) return false;
  return /^[A-Za-z0-9_-]{40,50}$/.test(token);
}

/**
 * Validates the enrollment form inputs client-side before submission.
 */
export function validateEnrollmentForm(data: EnrollmentFormData): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const childName = (data.child_name || '').trim();
  if (childName.length < 2 || childName.length > 80) {
    errors.child_name = "Child's name must be between 2 and 80 characters.";
  }

  const parentName = (data.parent_name || '').trim();
  if (parentName.length < 2 || parentName.length > 80) {
    errors.parent_name = "Parent's name must be between 2 and 80 characters.";
  }

  if (!isValidIndianMobilePhone(data.parent_phone)) {
    errors.parent_phone = 'Please enter a valid 10-digit Indian mobile number (starts with 6-9).';
  }

  if (data.parent_email && data.parent_email.trim()) {
    const email = data.parent_email.trim();
    if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.parent_email = 'Please enter a valid email address (max 120 characters).';
    }
  }

  if (data.address && data.address.trim().length > 300) {
    errors.address = 'Address must not exceed 300 characters.';
  }

  if (data.preferred_batch && data.preferred_batch.trim().length > 60) {
    errors.preferred_batch = 'Preferred batch must not exceed 60 characters.';
  }

  if (!data.consent) {
    errors.consent = 'Consent is required to proceed with registration.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Checks whether an enrollment link has reached its maximum submissions.
 */
export function isEnrollmentLinkFull(submissionsCount: number, maxSubmissions: number): boolean {
  return submissionsCount >= maxSubmissions;
}
