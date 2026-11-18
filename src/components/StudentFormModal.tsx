import React, { useEffect, useState, useRef } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Select } from './Select';
import { Button } from './Button';
import { validateStudentPhoto, uploadStudentPhoto } from '../services/storageService';
import { getAcademySettings } from '../services/academyService';
import { getBatches } from '../services/batchService';
import type { Student, StudentFormData, Batch } from '../types';
import { Upload, X, User } from 'lucide-react';
import { normalizeIndianPhone, PHONE_INPUT_HINT } from '../utils/formUtils';

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: StudentFormData) => Promise<boolean>;
  student?: Student | null; // If provided, edit mode
}

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  student,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [address, setAddress] = useState('');
  const [enrollmentDate, setEnrollmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [batchId, setBatchId] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [monthlyFee, setMonthlyFee] = useState<number | ''>(1500);

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load available batches
    getBatches().then(({ batches }) => {
      setBatches(batches);
    });

    if (student) {
      // Edit Mode
      setFullName(student.full_name || '');
      setPhone(student.phone || '');
      setEmail(student.email || '');
      setPhotoUrl(student.photo_url || null);
      setPhotoPreview(student.photo_url || null);
      setGuardianName(student.guardian_name || '');
      setGuardianPhone(student.guardian_phone || '');
      setAddress(student.address || '');
      setEnrollmentDate(student.enrollment_date || new Date().toISOString().split('T')[0]);
      setBatchId(student.batch_id || '');
      setStatus(student.status || 'active');
      setMonthlyFee(student.monthly_fee ?? 1500);
      setErrors({});
      setPhotoError(null);
    } else {
      // Add Mode: prefill default monthly fee from academy_settings
      getAcademySettings().then(({ settings }) => {
        setMonthlyFee(settings?.default_monthly_fee ?? 1500);
      });

      setFullName('');
      setPhone('');
      setEmail('');
      setPhotoUrl(null);
      setPhotoPreview(null);
      setGuardianName('');
      setGuardianPhone('');
      setAddress('');
      setEnrollmentDate(new Date().toISOString().split('T')[0]);
      setBatchId('');
      setStatus('active');
      setErrors({});
      setPhotoError(null);
    }
  }, [isOpen, student]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    const validation = validateStudentPhoto(file);
    if (!validation.valid) {
      setPhotoError(validation.error || 'Invalid photo');
      return;
    }

    // Local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);

    // Upload to Supabase Storage
    setIsUploadingPhoto(true);
    const { url, error } = await uploadStudentPhoto(file);
    setIsUploadingPhoto(false);

    if (error) {
      setPhotoError(error);
      setPhotoPreview(photoUrl); // Revert to previous
    } else if (url) {
      setPhotoUrl(url);
      setPhotoPreview(url);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(null);
    setPhotoPreview(null);
    setPhotoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Student full name is required.';
    }

    // Phone validation (10 digits Indian format, +91 optional)
    const cleanPhone = normalizeIndianPhone(phone);
    if (!cleanPhone) {
      newErrors.phone = 'Please enter a valid 10-digit mobile number (+91 is optional).';
    }

    // Email format validation (optional)
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    // Guardian phone validation (optional, 10 digits if provided)
    if (guardianPhone.trim()) {
      const cleanGPhone = normalizeIndianPhone(guardianPhone);
      if (!cleanGPhone) {
        newErrors.guardianPhone = 'Guardian phone must be a valid 10-digit mobile number.';
      }
    }

    // Monthly fee validation (>= 0)
    if (monthlyFee === '' || isNaN(Number(monthlyFee)) || Number(monthlyFee) < 0) {
      newErrors.monthlyFee = 'Monthly fee must be 0 or greater (in ₹).';
    }

    if (!enrollmentDate) {
      newErrors.enrollmentDate = 'Enrollment date is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const cleanPhone = normalizeIndianPhone(phone) || phone.trim();
    const cleanGPhone = guardianPhone.trim() ? (normalizeIndianPhone(guardianPhone) || guardianPhone.trim()) : '';

    const payload: StudentFormData = {
      full_name: fullName.trim(),
      phone: cleanPhone,
      email: email.trim(),
      photo_url: photoUrl,
      guardian_name: guardianName.trim(),
      guardian_phone: cleanGPhone,
      address: address.trim(),
      enrollment_date: enrollmentDate,
      batch_id: batchId || null,
      status,
      monthly_fee: Number(monthlyFee) || 0,
    };

    setIsSubmitting(true);
    const success = await onSubmit(payload);
    setIsSubmitting(false);

    if (success) {
      onClose();
    }
  };

  const batchOptions = [
    { value: '', label: 'No Batch (Unassigned)' },
    ...batches.map((b) => ({
      value: b.id,
      label: `${b.name} (${(b.days_of_week || []).join(', ')}) • ${b.student_count ?? 0}${
        b.capacity ? `/${b.capacity}` : ''
      } enrolled`,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={student ? 'Edit Student Details' : 'Add New Student'}
      description="Fill in the student profile details below. Mandatory fields are marked with *"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Photo Upload Section */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Student Photo (Optional)
          </label>
          <div className="flex items-center gap-4">
            <div className="relative w-18 h-18 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Student preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-slate-400" />
              )}
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                className="hidden"
                id="student-photo-file-input"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  loading={isUploadingPhoto}
                  icon={<Upload className="w-3.5 h-3.5" />}
                >
                  {photoPreview ? 'Change Photo' : 'Upload Photo'}
                </Button>
                {photoPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemovePhoto}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    icon={<X className="w-3.5 h-3.5" />}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                JPG, PNG, or WebP. Max 2 MB.
              </p>
              {photoError && <p className="text-xs text-red-600 font-medium">{photoError}</p>}
            </div>
          </div>
        </div>

        {/* Name and Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            name="fullName"
            required
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
            }}
            placeholder="e.g. Aryan Sharma"
            error={errors.fullName}
          />

          <Input
            label="Student Phone Number"
            name="phone"
            required
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
            }}
            placeholder="e.g. 9876543210"
            helperText={PHONE_INPUT_HINT}
            error={errors.phone}
          />
        </div>

        {/* Email and Enrollment Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Email Address (Optional)"
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
            }}
            placeholder="student@example.com"
            error={errors.email}
          />

          <Input
            label="Enrollment Date"
            name="enrollmentDate"
            type="date"
            required
            value={enrollmentDate}
            onChange={(e) => setEnrollmentDate(e.target.value)}
            error={errors.enrollmentDate}
          />
        </div>

        {/* Batch and Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Assigned Batch"
            name="batchId"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            options={batchOptions}
            helperText="Can be assigned or transferred later"
          />

          <Select
            label="Student Status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
            options={[
              { value: 'active', label: 'Active (Attending classes)' },
              { value: 'inactive', label: 'Inactive (Paused / discontinued)' },
            ]}
          />
        </div>

        {/* Monthly Fee */}
        <div>
          <Input
            label="Monthly Fee (₹ INR)"
            name="monthlyFee"
            required
            type="number"
            min="0"
            value={monthlyFee}
            onChange={(e) => {
              const val = e.target.value === '' ? '' : Number(e.target.value);
              setMonthlyFee(val);
              if (errors.monthlyFee) setErrors((prev) => ({ ...prev, monthlyFee: '' }));
            }}
            placeholder="1500"
            helperText="Stored individually for this student. Changing academy default fee will not affect this."
            error={errors.monthlyFee}
          />
        </div>

        {/* Guardian Details */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
            Guardian / Emergency Contact (Optional)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Guardian Name"
              name="guardianName"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              placeholder="e.g. Rajesh Sharma (Father)"
            />

            <Input
              label="Guardian Phone"
              name="guardianPhone"
              type="tel"
              value={guardianPhone}
              onChange={(e) => {
                setGuardianPhone(e.target.value);
                if (errors.guardianPhone) setErrors((prev) => ({ ...prev, guardianPhone: '' }));
              }}
              placeholder="e.g. 9876543210"
              helperText={PHONE_INPUT_HINT}
              error={errors.guardianPhone}
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address-field" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Residential Address (Optional)
          </label>
          <textarea
            id="address-field"
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 123 MG Road, Bengaluru"
            className="block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] placeholder-[var(--input-placeholder)] text-sm p-3 transition-colors focus-visible:border-indigo-600 dark:focus-visible:border-indigo-400"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={isUploadingPhoto}
          >
            {student ? 'Save Changes' : 'Create Student'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
