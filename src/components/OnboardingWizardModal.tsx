import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Image as ImageIcon,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { CurrencyInput } from './CurrencyInput';
import { FileUpload } from './FileUpload';
import { updateAcademySettings, uploadAcademyLogo } from '../services/academyService';
import { normalizeIndianPhone, PHONE_INPUT_HINT } from '../utils/formUtils';
import type { AcademySettings, DayOfWeek } from '../types';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (updatedSettings: AcademySettings) => void;
  initialSettings: AcademySettings | null;
}

const ALL_DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialSettings,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Academy Profile
  const [academyName, setAcademyName] = useState(initialSettings?.academy_name || 'MIX with Me Classes');
  const [contactNumber, setContactNumber] = useState(initialSettings?.contact_number || '');
  const [email, setEmail] = useState(initialSettings?.email || '');
  const [address, setAddress] = useState(initialSettings?.address || '');

  // Step 2: Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(initialSettings?.logo_url || null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);

  // Step 3: Default Fees & Working Days
  const [defaultMonthlyFee, setDefaultMonthlyFee] = useState(initialSettings?.default_monthly_fee || 1500);
  const [paymentDueDay, setPaymentDueDay] = useState(initialSettings?.payment_due_day || 5);
  const [workingDays, setWorkingDays] = useState<DayOfWeek[]>(
    initialSettings?.working_hours_config?.workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  );

  const toggleDay = (day: DayOfWeek) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleNextFromStep1 = () => {
    if (!academyName.trim()) {
      setError('Academy name is required.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleNextFromStep2 = () => {
    setError(null);
    setStep(3);
  };

  const handleFinish = async () => {
    if (workingDays.length === 0) {
      setError('Please select at least one working day.');
      return;
    }
    if (paymentDueDay < 1 || paymentDueDay > 28) {
      setError('Payment due day must be between 1 and 28.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let finalLogoUrl = logoUrl;
      if (selectedLogoFile) {
        const { url, error: logoErr } = await uploadAcademyLogo(selectedLogoFile);
        if (logoErr) throw new Error(logoErr);
        finalLogoUrl = url;
      }

      const { settings: updated, error: updateErr } = await updateAcademySettings({
        academy_name: academyName.trim(),
        contact_number: contactNumber.trim() ? (normalizeIndianPhone(contactNumber) || contactNumber.trim()) : null,
        email: email.trim() || null,
        address: address.trim() || null,
        logo_url: finalLogoUrl,
        default_monthly_fee: defaultMonthlyFee,
        payment_due_day: paymentDueDay,
        is_onboarding_completed: true,
        working_hours_config: {
          workingDays,
          weekdayWindow: initialSettings?.working_hours_config?.weekdayWindow || {
            startTime: '14:00',
            endTime: '21:00',
          },
          weekendWindow: initialSettings?.working_hours_config?.weekendWindow || {
            startTime: '10:00',
            endTime: '18:00',
          },
          minBreakMinutes: initialSettings?.working_hours_config?.minBreakMinutes || 10,
          maxClassesPerDay: initialSettings?.working_hours_config?.maxClassesPerDay || null,
        },
      });

      if (updateErr || !updated) {
        throw new Error(updateErr || 'Failed to update academy settings');
      }

      onComplete(updated);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save academy setup.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Welcome to MIX with Me Classes" maxWidth="lg">
      <div className="space-y-6">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  step === s
                    ? 'bg-indigo-600 text-white'
                    : step > s
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {step > s ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{s}</span>}
                <span>
                  {s === 1 ? 'Profile' : s === 2 ? 'Logo' : 'Fees & Schedule'}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline min-h-[44px] flex items-center"
          >
            Skip for now
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Step 1: Academy Details</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                These details will appear on student receipts, reports, and reminders.
              </p>

              <Input
                label="Academy Name"
                value={academyName}
                onChange={(e) => setAcademyName(e.target.value)}
                placeholder="e.g. Symphony Music Academy"
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Contact Phone Number"
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. 9876543210"
                  helperText={PHONE_INPUT_HINT}
                />
                <Input
                  label="Contact Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. academy@example.com"
                />
              </div>

              <Input
                label="Academy Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 102 Harmony Lane, Indiranagar, Bengaluru"
              />

              <div className="flex justify-end pt-4">
                <Button type="button" variant="primary" onClick={handleNextFromStep1} icon={ArrowRight}>
                  Next: Academy Logo
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Step 2: Academy Logo (Optional)</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload your academy logo. It will be printed at the top of payment receipts and export reports. You can change this anytime.
              </p>

              <FileUpload
                label="Upload Logo (PNG, JPG, WebP &le; 2 MB)"
                previewUrl={selectedLogoFile ? URL.createObjectURL(selectedLogoFile) : logoUrl}
                onFileSelect={(file) => setSelectedLogoFile(file)}
                onClear={() => {
                  setSelectedLogoFile(null);
                  setLogoUrl(null);
                }}
              />

              <div className="flex justify-between items-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  icon={ArrowLeft}
                >
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={handleNextFromStep2}>
                    Skip Logo
                  </Button>
                  <Button type="button" variant="primary" onClick={handleNextFromStep2} icon={ArrowRight}>
                    Next: Fees &amp; Schedule
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Step 3: Tuition Fees &amp; Working Days</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure your default tuition rate and the days your music academy teaches classes.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CurrencyInput
                  label="Default Monthly Fee (₹)"
                  value={defaultMonthlyFee}
                  onChange={(val) => setDefaultMonthlyFee(val)}
                  helperText="Pre-filled when registering new students."
                />
                <Input
                  label="Monthly Payment Due Day (1-28)"
                  type="number"
                  min={1}
                  max={28}
                  value={paymentDueDay}
                  onChange={(e) => setPaymentDueDay(parseInt(e.target.value, 10) || 5)}
                  helperText="Day of month when fees become due."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Academy Teaching Days (Working Days)
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_DAYS.map((day) => {
                    const isSelected = workingDays.includes(day);
                    const isWeekend = day === 'Sat' || day === 'Sun';

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all min-h-[44px] flex items-center justify-center ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-white dark:bg-[#1a2540] border-slate-200 dark:border-[#26324a] text-slate-700 dark:text-[#f1f5f9] hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {day} {isWeekend && <span className="ml-1 text-xs opacity-80">(Weekend)</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 dark:text-[#a9b4c7] mt-2">
                  Weekdays are enabled by default. Weekend slots will only be scheduled if toggled ON.
                </p>
              </div>

              <div className="flex justify-between items-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  icon={ArrowLeft}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleFinish}
                  loading={isSubmitting}
                  icon={Sparkles}
                >
                  Complete Setup &amp; Launch
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
};
