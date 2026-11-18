import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  Info,
  DollarSign,
  Building,
} from 'lucide-react';
import { SettingsSubNav } from '../components/SettingsSubNav';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { CurrencyInput } from '../components/CurrencyInput';
import { FileUpload } from '../components/FileUpload';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  getAcademySettings,
  updateAcademySettings,
  uploadAcademyLogo,
} from '../services/academyService';
import { formatIndianCurrency } from '../utils/feeUtils';
import { normalizeIndianPhone, PHONE_INPUT_HINT } from '../utils/formUtils';
import type { AcademySettings } from '../types';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AcademySettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [academyName, setAcademyName] = useState('MIX with Me Classes');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [defaultMonthlyFee, setDefaultMonthlyFee] = useState<number>(1500);
  const [initialDefaultFee, setInitialDefaultFee] = useState<number>(1500);
  const [paymentDueDay, setPaymentDueDay] = useState<number>(5);

  // Feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConfirmFeeOpen, setIsConfirmFeeOpen] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { settings: data, error } = await getAcademySettings();
      if (error) {
        setErrorMsg(error);
      } else if (data) {
        setSettings(data);
        setAcademyName(data.academy_name || 'MIX with Me Classes');
        setLogoUrl(data.logo_url || null);
        setContactNumber(data.contact_number || '');
        setEmail(data.email || '');
        setAddress(data.address || '');
        setDefaultMonthlyFee(data.default_monthly_fee ?? 1500);
        setInitialDefaultFee(data.default_monthly_fee ?? 1500);
        setPaymentDueDay(data.payment_due_day ?? 5);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true);
    setErrorMsg(null);
    try {
      const { url, error } = await uploadAcademyLogo(file);
      if (error || !url) {
        setErrorMsg(error || 'Failed to upload logo.');
      } else {
        setLogoUrl(url);
        setSuccessMsg('Logo uploaded successfully. Click "Save Settings" to apply.');
      }
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    // 1. Validations
    if (!academyName.trim()) {
      setErrorMsg('Academy name is required.');
      return;
    }

    if (contactNumber.trim()) {
      const cleanPhone = normalizeIndianPhone(contactNumber);
      if (!cleanPhone) {
        setErrorMsg('Contact number must be a valid 10-digit mobile number (+91 is optional).');
        return;
      }
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
    }

    if (defaultMonthlyFee < 0) {
      setErrorMsg('Default monthly fee cannot be negative.');
      return;
    }

    if (paymentDueDay < 1 || paymentDueDay > 28) {
      setErrorMsg('Payment due day must be between 1 and 28.');
      return;
    }

    // 2. Check if default fee changed: require confirmation
    if (defaultMonthlyFee !== initialDefaultFee) {
      setIsConfirmFeeOpen(true);
      return;
    }

    executeSave();
  };

  const executeSave = async () => {
    if (!settings?.id) return;

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { settings: updated, error } = await updateAcademySettings(settings.id, {
        academy_name: academyName,
        logo_url: logoUrl,
        contact_number: contactNumber.trim() ? (normalizeIndianPhone(contactNumber) || contactNumber.trim()) : null,
        email,
        address,
        default_monthly_fee: defaultMonthlyFee,
        payment_due_day: paymentDueDay,
      });

      if (error || !updated) {
        setErrorMsg(error || 'Failed to update academy settings.');
      } else {
        setSettings(updated);
        setInitialDefaultFee(updated.default_monthly_fee);
        setSuccessMsg('Academy settings updated successfully!');
      }
    } finally {
      setIsSaving(false);
      setIsConfirmFeeOpen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          Settings, Backups &amp; Exports
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure your music academy profile, fee defaults, database backups, and data exports.
        </p>
      </div>

      {/* Sub-Navigation Tabs */}
      <SettingsSubNav />

      {/* Main Settings Form */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#111A2B] rounded-2xl border border-slate-200 dark:border-[#1F2A3D]">
          <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-2" />
          Loading academy settings...
        </div>
      ) : (
        <form onSubmit={handleSaveAttempt} className="space-y-6">
          {/* Success Banner */}
          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="font-bold text-emerald-600 hover:text-emerald-800"
              >
                ✕
              </button>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="font-bold text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          )}

          {/* 1. Academy Profile Card */}
          <div className="bg-white dark:bg-[#111a2b] border border-slate-200 dark:border-[#1f2a3d] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Building className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Academy Profile</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Academy Name */}
              <div className="md:col-span-2">
                <Input
                  label="Academy Name"
                  required
                  value={academyName}
                  onChange={(e) => setAcademyName(e.target.value)}
                  placeholder="e.g. MIX with Me Classes"
                />
              </div>

              {/* Academy Logo */}
              <div className="md:col-span-2">
                <FileUpload
                  label="Academy Logo"
                  previewUrl={logoUrl}
                  onFileSelect={handleLogoUpload}
                  onClear={() => setLogoUrl(null)}
                  disabled={isUploadingLogo || isSaving}
                  helperText="Appears on official fee receipts and export headers. Max 2 MB (PNG, JPG, WebP)."
                />
              </div>

              {/* Contact Number */}
              <div>
                <Input
                  label="Contact Phone"
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. 9876543210"
                  helperText={PHONE_INPUT_HINT}
                />
              </div>

              {/* Email */}
              <div>
                <Input
                  label="Contact Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. academy@example.com"
                />
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Academy Address / Studio Location
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 102 Harmony Lane, Indiranagar, Bengaluru"
                  className="block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] placeholder-[var(--input-placeholder)] px-3 py-2 text-sm transition-colors focus-visible:border-indigo-600 dark:focus-visible:border-indigo-400"
                />
              </div>
            </div>
          </div>

          {/* 2. Default Fee & Payment Settings Card */}
          <div className="bg-white dark:bg-[#111a2b] border border-slate-200 dark:border-[#1f2a3d] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <DollarSign className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Default Fee Rules</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Default Monthly Fee */}
              <div>
                <CurrencyInput
                  label="Default Monthly Student Fee"
                  required
                  value={defaultMonthlyFee}
                  onChange={(val) => setDefaultMonthlyFee(val)}
                  helperText="Applied when adding a new student."
                />
              </div>

              {/* Payment Due Day */}
              <div>
                <Input
                  label="Monthly Payment Due Day (1 - 28)"
                  type="number"
                  required
                  min={1}
                  max={28}
                  value={paymentDueDay}
                  onChange={(e) => setPaymentDueDay(parseInt(e.target.value, 10) || 5)}
                  helperText="Day of each month fee becomes due."
                />
              </div>

              {/* Fixed Currency */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Default Currency
                </label>
                <input
                  type="text"
                  disabled
                  value="INR — Indian Rupee (₹)"
                  className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Fixed platform currency.</p>
              </div>
            </div>

            {/* Explanatory Policy Note */}
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Important Fee Policy</p>
                <p className="mt-0.5 text-blue-800 dark:text-blue-300">
                  Changing the default fee affects <strong>newly added students only</strong>. Existing
                  students keep their assigned fees and can have their fee adjusted individually on their
                  profile.
                </p>
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              loading={isSaving || isUploadingLogo}
              icon={Save}
            >
              Save Settings
            </Button>
          </div>
        </form>
      )}

      {/* Confirmation Dialog for Default Fee Change */}
      <ConfirmDialog
        isOpen={isConfirmFeeOpen}
        onClose={() => setIsConfirmFeeOpen(false)}
        onConfirm={executeSave}
        title="Confirm Default Fee Change"
        message={
          <>
            You are changing the default student monthly fee from{' '}
            <strong className="text-slate-900">{formatIndianCurrency(initialDefaultFee)}</strong> to{' '}
            <strong className="text-indigo-600">{formatIndianCurrency(defaultMonthlyFee)}</strong>.
            <br />
            <br />
            This will apply to <strong>newly enrolled students only</strong>. Existing students will
            keep their currently assigned fees.
            <br />
            <br />
            Do you wish to proceed?
          </>
        }
        confirmText="Yes, Update Default Fee"
        cancelText="Cancel"
        variant="primary"
        loading={isSaving}
      />
    </div>
  );
};
