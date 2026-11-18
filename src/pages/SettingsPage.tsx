import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  Info,
  DollarSign,
  Building,
  QrCode,
  Trash2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { SettingsSubNav } from '../components/SettingsSubNav';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { CurrencyInput } from '../components/CurrencyInput';
import { FileUpload } from '../components/FileUpload';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import {
  getAcademySettings,
  updateAcademySettings,
  uploadAcademyLogo,
  uploadUpiQrCode,
  deleteUpiQrCode,
} from '../services/academyService';
import { formatIndianCurrency } from '../utils/feeUtils';
import { normalizeIndianPhone, PHONE_INPUT_HINT } from '../utils/formUtils';
import {
  validateUpiId,
  formatPayeeName,
  buildUpiPayUri,
  generateUpiQrDataUrl,
  dataUrlToBlob,
} from '../utils/upiUtils';
import type { AcademySettings } from '../types';

export const SettingsPage: React.FC = () => {
  const { toast } = useToast();
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

  // Payment Details (UPI)
  const [upiId, setUpiId] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [upiQrPath, setUpiQrPath] = useState<string | null>(null);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [isConfirmQrRemoveOpen, setIsConfirmQrRemoveOpen] = useState(false);
  const [isConfirmQrReplaceOpen, setIsConfirmQrReplaceOpen] = useState(false);
  const [pendingQrPayload, setPendingQrPayload] = useState<{
    fileOrBlob: File | Blob;
    preview: string;
  } | null>(null);

  const qrFileInputRef = useRef<HTMLInputElement>(null);

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
        setUpiId(data.upi_id || '');
        setUpiPayeeName(data.upi_payee_name || '');
        setUpiQrPath(data.upi_qr_path || null);
        if (data.upi_qr_path) {
          const { data: urlData } = supabase.storage
            .from('academy-assets')
            .getPublicUrl(data.upi_qr_path);
          setQrPreviewUrl(urlData.publicUrl);
        } else {
          setQrPreviewUrl(null);
        }
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

  // Compress image client-side to ensure <= 2MB
  const compressImage = async (file: File): Promise<Blob> => {
    if (file.size <= 2 * 1024 * 1024 && file.type === 'image/png') {
      return file;
    }
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            resolve(blob || file);
          },
          'image/png',
          0.9
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  };

  const handleQrUploadSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    try {
      const compressedBlob = await compressImage(file);
      const preview = URL.createObjectURL(compressedBlob);

      if (upiQrPath) {
        setPendingQrPayload({ fileOrBlob: compressedBlob, preview });
        setIsConfirmQrReplaceOpen(true);
      } else {
        await executeUploadQr(compressedBlob, preview);
      }
    } catch {
      setErrorMsg('Failed to process QR code image.');
    } finally {
      if (qrFileInputRef.current) qrFileInputRef.current.value = '';
    }
  };

  const handleGenerateQr = async () => {
    setErrorMsg(null);
    if (!upiId.trim()) {
      setErrorMsg('Please enter a valid UPI ID before generating a QR code.');
      return;
    }
    const { isValid, error } = validateUpiId(upiId);
    if (!isValid) {
      setErrorMsg(error || 'Invalid UPI ID format.');
      return;
    }

    setIsGeneratingQr(true);
    try {
      const payee = formatPayeeName(upiPayeeName, academyName);
      const uri = buildUpiPayUri(upiId, payee);
      const dataUrl = await generateUpiQrDataUrl(uri);
      const blob = dataUrlToBlob(dataUrl, 'image/png');

      if (upiQrPath) {
        setPendingQrPayload({ fileOrBlob: blob, preview: dataUrl });
        setIsConfirmQrReplaceOpen(true);
      } else {
        await executeUploadQr(blob, dataUrl);
      }
    } catch (err: unknown) {
      if (import.meta.env.DEV) {
        console.error('QR code generation error:', err);
      }
      const failureNotice = 'Could not generate the QR code. Try uploading an image instead.';
      setErrorMsg(failureNotice);
      toast(failureNotice, 'error');
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const executeUploadQr = async (fileOrBlob: File | Blob, preview: string) => {
    setIsUploadingQr(true);
    setErrorMsg(null);
    try {
      const { path, url, error } = await uploadUpiQrCode(fileOrBlob);
      if (error || !path) {
        const failureNotice = 'Could not generate the QR code. Try uploading an image instead.';
        setErrorMsg(error || failureNotice);
        toast(failureNotice, 'error');
      } else {
        // Save upi_qr_path in academy_settings
        const { error: updateError } = await updateAcademySettings({ upi_qr_path: path });
        if (updateError && import.meta.env.DEV) {
          console.error('Failed to save upi_qr_path to academy_settings:', updateError);
        }
        setUpiQrPath(path);
        setQrPreviewUrl(url || preview);
        setSuccessMsg('UPI QR code generated and saved successfully.');
        toast('UPI QR code generated and saved successfully.', 'success');
      }
    } catch (err: unknown) {
      if (import.meta.env.DEV) {
        console.error('QR upload error:', err);
      }
      const failureNotice = 'Could not generate the QR code. Try uploading an image instead.';
      setErrorMsg(failureNotice);
      toast(failureNotice, 'error');
    } finally {
      setIsUploadingQr(false);
      setIsConfirmQrReplaceOpen(false);
      setPendingQrPayload(null);
    }
  };

  const handleConfirmQrReplace = async () => {
    if (!pendingQrPayload) return;
    await executeUploadQr(pendingQrPayload.fileOrBlob, pendingQrPayload.preview);
  };

  const handleConfirmQrRemove = async () => {
    setIsUploadingQr(true);
    setErrorMsg(null);
    try {
      const { success, error } = await deleteUpiQrCode();
      if (!success && error) {
        setErrorMsg(error);
      } else {
        setUpiQrPath(null);
        setQrPreviewUrl(null);
        setSuccessMsg('UPI QR code removed. Click "Save Settings" to save changes.');
      }
    } finally {
      setIsUploadingQr(false);
      setIsConfirmQrRemoveOpen(false);
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

    if (upiId.trim()) {
      const { isValid, error } = validateUpiId(upiId);
      if (!isValid) {
        setErrorMsg(error || 'Invalid UPI ID format. Must be name@handle.');
        return;
      }
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
        upi_id: upiId.trim() ? upiId.trim().toLowerCase() : null,
        upi_payee_name: upiPayeeName.trim() ? formatPayeeName(upiPayeeName, academyName) : null,
        upi_qr_path: upiQrPath,
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
        <div className="py-16 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a]">
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
          <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-6 shadow-xs space-y-5">
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

          {/* 2. Payment Details (UPI) Card */}
          <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Payment Details (UPI)</h2>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Set this once. Payment requests and receipts will use it automatically.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* UPI ID */}
              <div>
                <Input
                  label="Academy UPI ID (VPA)"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value.toLowerCase().trim())}
                  placeholder="e.g. academy@okaxis or music@upi"
                  helperText="Format: name@handle. Lowercase letters, digits, and dots followed by bank handle."
                />
              </div>

              {/* Payee Name */}
              <div>
                <Input
                  label="Payee Name"
                  value={upiPayeeName}
                  onChange={(e) => setUpiPayeeName(e.target.value.slice(0, 60))}
                  placeholder={academyName || 'MIX with Me Classes'}
                  maxLength={60}
                  helperText={`Name registered on bank UPI. Max 60 characters (${upiPayeeName.length}/60). Defaults to academy name.`}
                />
              </div>

              {/* UPI QR Code Section */}
              <div className="md:col-span-2 space-y-3 pt-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Academy UPI QR Code
                </label>

                {qrPreviewUrl ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                    <div className="w-36 h-36 bg-white p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs shrink-0 flex items-center justify-center">
                      <img
                        src={qrPreviewUrl}
                        alt="UPI QR Code"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <p className="font-semibold text-slate-900 dark:text-white">Active Payment QR Code</p>
                        <p className="font-mono text-slate-500 dark:text-slate-400">{upiId || 'No UPI ID saved'}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Stored securely at your account's private storage path.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon={Upload}
                          disabled={isUploadingQr || isGeneratingQr}
                          onClick={() => qrFileInputRef.current?.click()}
                        >
                          Replace QR (Upload)
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon={RefreshCw}
                          loading={isGeneratingQr}
                          disabled={isUploadingQr || !upiId.trim()}
                          onClick={handleGenerateQr}
                        >
                          Regenerate from UPI ID
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={Trash2}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                          disabled={isUploadingQr || isGeneratingQr}
                          onClick={() => setIsConfirmQrRemoveOpen(true)}
                        >
                          Remove QR
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Option A: Upload Custom QR Image */}
                    <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-between space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          Option A: Upload QR Image
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Upload your bank's official UPI QR code image or standalone photo. Max 2 MB (compressed automatically).
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isUploadingQr || isGeneratingQr}
                        onClick={() => qrFileInputRef.current?.click()}
                        icon={Upload}
                      >
                        Choose QR Image
                      </Button>
                    </div>

                    {/* Option B: Generate QR from UPI ID */}
                    <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-between space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          Option B: Generate QR from UPI ID
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Generate a clean standard NPCI QR code automatically encoding your UPI ID and payee name.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={isGeneratingQr}
                        disabled={isUploadingQr || !upiId.trim()}
                        onClick={handleGenerateQr}
                        icon={RefreshCw}
                      >
                        Generate QR from UPI ID
                      </Button>
                    </div>
                  </div>
                )}

                {/* Hidden file input for QR upload */}
                <input
                  ref={qrFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleQrUploadSelect}
                />
              </div>
            </div>

            {/* Explanatory Verification Policy Note */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Manual Payment Verification Note</p>
                <p className="mt-0.5">
                  The app does not automatically verify UPI payments. When a student transfers funds via UPI,
                  verify the receipt in your UPI bank app first, then record the payment along with the UTR number.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Default Fee & Payment Settings Card */}
          <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-6 shadow-xs space-y-5">
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

      {/* Confirmation Dialog for QR Code Replacement */}
      <ConfirmDialog
        isOpen={isConfirmQrReplaceOpen}
        onClose={() => {
          setIsConfirmQrReplaceOpen(false);
          setPendingQrPayload(null);
        }}
        onConfirm={handleConfirmQrReplace}
        title="Replace UPI QR Code"
        message="Are you sure you want to replace your existing academy UPI QR code? Future payment requests and receipts will display the new QR code."
        confirmText="Yes, Replace QR"
        cancelText="Cancel"
        variant="primary"
        loading={isUploadingQr}
      />

      {/* Confirmation Dialog for QR Code Removal */}
      <ConfirmDialog
        isOpen={isConfirmQrRemoveOpen}
        onClose={() => setIsConfirmQrRemoveOpen(false)}
        onConfirm={handleConfirmQrRemove}
        title="Remove UPI QR Code"
        message="Are you sure you want to remove the saved UPI QR code? Payment requests will not be able to display a QR code until a new one is set."
        confirmText="Yes, Remove QR"
        cancelText="Cancel"
        variant="danger"
        loading={isUploadingQr}
      />
    </div>
  );
};
