import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
} from 'lucide-react';
import {
  validateEnrollmentForm,
  isValidIndianMobilePhone,
  isValidEnrollmentToken,
} from '../utils/enrollmentUtils';
import {
  compressImageIfLarge,
  MAX_FILE_SIZE_BYTES,
  validateImageUpload,
} from '../utils/fileUploadUtils';

export const EnrollPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  // Meta tags for security and privacy
  useEffect(() => {
    let metaReferrer = document.querySelector('meta[name="referrer"]');
    let addedReferrer = false;
    if (!metaReferrer) {
      metaReferrer = document.createElement('meta');
      metaReferrer.setAttribute('name', 'referrer');
      document.head.appendChild(metaReferrer);
      addedReferrer = true;
    }
    metaReferrer.setAttribute('content', 'no-referrer');

    let metaRobots = document.querySelector('meta[name="robots"]');
    let addedRobots = false;
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.setAttribute('name', 'robots');
      document.head.appendChild(metaRobots);
      addedRobots = true;
    }
    metaRobots.setAttribute('content', 'noindex, nofollow');

    return () => {
      if (addedReferrer && metaReferrer?.parentNode) {
        metaReferrer.parentNode.removeChild(metaReferrer);
      }
      if (addedRobots && metaRobots?.parentNode) {
        metaRobots.parentNode.removeChild(metaRobots);
      }
    };
  }, []);

  // Form states
  const [childName, setChildName] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [address, setAddress] = useState('');
  const [preferredBatch, setPreferredBatch] = useState('');
  const [consent, setConsent] = useState(false);

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Submission lifecycle states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Validate token presence & format
  const isTokenFormatValid = useMemo(() => {
    return isValidEnrollmentToken(token || '');
  }, [token]);

  // Form validity check for enabling/disabling submit button
  const formValidation = useMemo(() => {
    return validateEnrollmentForm({
      child_name: childName,
      parent_name: parentName,
      parent_phone: parentPhone,
      parent_email: parentEmail || undefined,
      address: address || undefined,
      preferred_batch: preferredBatch || undefined,
      consent,
    });
  }, [childName, parentName, parentPhone, parentEmail, address, preferredBatch, consent]);

  const isSubmitDisabled =
    !isTokenFormatValid ||
    !consent ||
    !formValidation.isValid ||
    isSubmitting ||
    isSuccess;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setPhotoError('Photo size must be 2 MB or less.');
      setPhotoFile(null);
      setPhotoPreview(null);
      e.target.value = '';
      return;
    }

    try {
      const buffer = await file.slice(0, 32).arrayBuffer();
      const validation = validateImageUpload(file.size, file.type, new Uint8Array(buffer));
      if (!validation.isValid) {
        setPhotoError(validation.error || 'Please upload a valid JPEG, PNG, or WebP photo.');
        setPhotoFile(null);
        setPhotoPreview(null);
        e.target.value = '';
        return;
      }
    } catch {
      setPhotoError('Unable to inspect file format.');
      setPhotoFile(null);
      setPhotoPreview(null);
      e.target.value = '';
      return;
    }

    setPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled || !token) return;

    setIsSubmitting(true);
    setGlobalError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // 1. Submit text registration payload
      const cleanPhone = parentPhone.replace(/\D/g, '');
      const payload: Record<string, unknown> = {
        token,
        child_name: childName.trim(),
        parent_name: parentName.trim(),
        parent_phone: cleanPhone,
        consent: true,
      };

      if (parentEmail.trim()) {
        payload.parent_email = parentEmail.trim();
      }
      if (address.trim()) {
        payload.address = address.trim();
      }
      if (preferredBatch.trim()) {
        payload.preferred_batch = preferredBatch.trim();
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/submit-enrollment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setGlobalError('This registration link is no longer valid. Ask the academy for a new link.');
        setIsSubmitting(false);
        return;
      }

      const resData = await res.json();
      const submissionId = resData?.submission_id;

      // 2. Upload photo if selected and submission_id returned
      if (photoFile && submissionId) {
        try {
          const compressedBlob = await compressImageIfLarge(photoFile);
          const uploadFile =
            compressedBlob instanceof File
              ? compressedBlob
              : new File([compressedBlob], 'student.jpg', {
                  type: compressedBlob.type || 'image/jpeg',
                });

          const formData = new FormData();
          formData.append('token', token);
          formData.append('submission_id', submissionId);
          formData.append('file', uploadFile);

          await fetch(`${supabaseUrl}/functions/v1/upload-enrollment-photo`, {
            method: 'POST',
            headers: {
              apikey: anonKey,
            },
            body: formData,
          });
        } catch {
          // Photo upload is non-blocking for registration completion
        }
      }

      setIsSuccess(true);
    } catch {
      setGlobalError('This registration link is no longer valid. Ask the academy for a new link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-lg bg-white dark:bg-[#161f30] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
            <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Student Registration</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Music Academy Enrollment
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Please fill in your child's enrollment details below.
          </p>
        </div>

        {!isTokenFormatValid ? (
          <div className="p-6 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Invalid Registration Link
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This registration link is no longer valid. Ask the academy for a new link.
            </p>
          </div>
        ) : isSuccess ? (
          <div className="p-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Registration Submitted
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Thank you. The academy will contact you after reviewing your details.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {globalError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{globalError}</span>
              </div>
            )}

            {/* Child's Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="child_name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Child's Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="child_name"
                data-testid="child_name_input"
                type="text"
                required
                maxLength={80}
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Parent Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="parent_name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Parent / Guardian Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="parent_name"
                data-testid="parent_name_input"
                type="text"
                required
                maxLength={80}
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="e.g. Rohan Sharma"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Parent Phone */}
            <div className="space-y-1.5">
              <label
                htmlFor="parent_phone"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Parent Phone Number (10 digits) <span className="text-rose-500">*</span>
              </label>
              <input
                id="parent_phone"
                data-testid="parent_phone_input"
                type="tel"
                required
                maxLength={10}
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 9876543210"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              {parentPhone && !isValidIndianMobilePhone(parentPhone) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Must be a valid 10-digit Indian mobile number (starts with 6-9).
                </p>
              )}
            </div>

            {/* Parent Email (Optional) */}
            <div className="space-y-1.5">
              <label
                htmlFor="parent_email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Parent Email <span className="text-xs text-slate-400">(Optional)</span>
              </label>
              <input
                id="parent_email"
                data-testid="parent_email_input"
                type="email"
                maxLength={120}
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="e.g. parent@example.com"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Residential Address (Optional) */}
            <div className="space-y-1.5">
              <label
                htmlFor="address"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Residential Address <span className="text-xs text-slate-400">(Optional)</span>
              </label>
              <textarea
                id="address"
                data-testid="address_input"
                rows={2}
                maxLength={300}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Flat / Street, City, Pincode"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Preferred Batch / Notes (Optional) */}
            <div className="space-y-1.5">
              <label
                htmlFor="preferred_batch"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Preferred Batch / Instruments <span className="text-xs text-slate-400">(Optional)</span>
              </label>
              <input
                id="preferred_batch"
                data-testid="preferred_batch_input"
                type="text"
                maxLength={60}
                value={preferredBatch}
                onChange={(e) => setPreferredBatch(e.target.value)}
                placeholder="e.g. Weekend Piano Beginners"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Student Photo Upload (Optional) */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Child's Photo <span className="text-xs text-slate-400">(Optional)</span>
              </label>
              <div className="flex items-center gap-3">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                    <Camera className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <input
                    type="file"
                    id="enrollment-photo-input"
                    data-testid="enrollment_photo_input"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={isSubmitting}
                    onChange={handlePhotoChange}
                    className="block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-950/60 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 cursor-pointer disabled:opacity-50"
                  />
                  <p className="text-[11px] text-slate-400">
                    JPEG, PNG, or WebP up to 2 MB.
                  </p>
                </div>
              </div>
              {photoError && (
                <p className="text-xs text-rose-500 font-medium">{photoError}</p>
              )}
            </div>

            {/* Consent Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="consent_checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                />
                <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  I agree that the academy may store these details to manage my child's enrollment.
                  I can ask for them to be deleted at any time.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitDisabled}
                data-testid="submit_enrollment_button"
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Registration...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Submit Registration</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer Credit */}
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-6">
          Made by Kenith Karas
        </p>
      </div>
    </div>
  );
};
