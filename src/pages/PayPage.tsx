import React, { useEffect, useState, useMemo } from 'react';
import { ShieldCheck, Copy, Check, AlertCircle, Loader2, Upload, FileCheck } from 'lucide-react';
import {
  compressImageIfLarge,
  MAX_FILE_SIZE_BYTES,
  validateImageUpload,
} from '../utils/fileUploadUtils';

interface ResolvedPaymentData {
  payee_name: string;
  upi_id: string;
  amount: string;
  note: string;
}

export const PayPage: React.FC = () => {
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOutOfDate, setIsOutOfDate] = useState(false);
  const [paymentData, setPaymentData] = useState<ResolvedPaymentData | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Screenshot upload states
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Inject strict no-referrer and noindex meta tags
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

  // Inspect query parameters and resolve payment link
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const rawToken = params.get('t')?.trim();
    const hasLegacyParams =
      params.has('pa') ||
      params.has('pn') ||
      params.has('am') ||
      params.has('tn') ||
      params.has('tr');

    // If legacy parameters are present without t, show "out of date" message
    if (!rawToken && hasLegacyParams) {
      setIsOutOfDate(true);
      setErrorMsg('This payment link is out of date. Ask the academy for a new link.');
      setIsLoading(false);
      return;
    }

    // If token is missing, show generic invalid message
    if (!rawToken) {
      setIsOutOfDate(false);
      setErrorMsg('This payment link is not valid. Ask the academy for a new link.');
      setIsLoading(false);
      return;
    }

    setToken(rawToken);

    let isMounted = true;
    setIsLoading(true);
    setErrorMsg(null);
    setIsOutOfDate(false);

    async function resolveSignedLink() {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const res = await fetch(`${supabaseUrl}/functions/v1/resolve-payment-link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
          },
          body: JSON.stringify({ token: rawToken }),
        });

        if (!res.ok) {
          if (isMounted) {
            setErrorMsg('This payment link is not valid. Ask the academy for a new link.');
          }
          return;
        }

        const data = await res.json();
        if (isMounted) {
          if (data && data.payee_name && data.upi_id && data.amount && data.note) {
            setPaymentData(data);
          } else {
            setErrorMsg('This payment link is not valid. Ask the academy for a new link.');
          }
        }
      } catch {
        if (isMounted) {
          setErrorMsg('This payment link is not valid. Ask the academy for a new link.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    resolveSignedLink();

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePayClick = () => {
    if (!paymentData) return;
    const cleanPa = paymentData.upi_id.trim();
    const cleanPn = paymentData.payee_name.trim().slice(0, 60);
    const cleanAm = paymentData.amount.trim();
    const cleanTn = paymentData.note.trim().slice(0, 80);
    const uri = `upi://pay?pa=${encodeURIComponent(cleanPa)}&pn=${encodeURIComponent(cleanPn)}&am=${encodeURIComponent(cleanAm)}&tn=${encodeURIComponent(cleanTn)}&cu=INR`;
    window.location.href = uri;
  };

  const handleCopyUpi = async () => {
    if (!paymentData?.upi_id) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(paymentData.upi_id);
      }
    } catch {
      // clipboard fallback
    } finally {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setScreenshotFile(null);
      return;
    }

    // Check size limit: reject files > 2 MB before upload
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError('File size must be 2 MB or less.');
      setScreenshotFile(null);
      e.target.value = '';
      return;
    }

    // Inspect file format and magic bytes
    try {
      const buffer = await file.slice(0, 32).arrayBuffer();
      const validation = validateImageUpload(file.size, file.type, new Uint8Array(buffer));
      if (!validation.isValid) {
        setUploadError(validation.error || 'Please upload a valid JPEG, PNG, or WebP image.');
        setScreenshotFile(null);
        e.target.value = '';
        return;
      }
    } catch {
      setUploadError('Unable to inspect file format.');
      setScreenshotFile(null);
      e.target.value = '';
      return;
    }

    setScreenshotFile(file);
  };

  const handleUploadScreenshot = async () => {
    if (!screenshotFile || !token || isUploading || uploadSuccess) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // Client-side compression if over 1.5 MB
      const processedBlob = await compressImageIfLarge(screenshotFile);
      const uploadFile =
        processedBlob instanceof File
          ? processedBlob
          : new File([processedBlob], 'screenshot.jpg', { type: processedBlob.type || 'image/jpeg' });

      const formData = new FormData();
      formData.append('token', token);
      formData.append('file', uploadFile);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/upload-payment-screenshot`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
        },
        body: formData,
      });

      if (!res.ok) {
        setUploadError('Upload failed. Please try again or send the screenshot to the academy directly.');
        return;
      }

      setUploadSuccess(true);
    } catch {
      setUploadError('Upload failed. Please try again or send the screenshot to the academy directly.');
    } finally {
      setIsUploading(false);
    }
  };

  const formattedAmount = useMemo(() => {
    if (!paymentData?.amount) return '';
    const num = parseFloat(paymentData.amount);
    return (
      '₹' +
      new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num)
    );
  }, [paymentData?.amount]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-[#161f30] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Loading payment details...
            </p>
          </div>
        ) : errorMsg || !paymentData ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                {isOutOfDate ? 'Payment Link Out of Date' : 'Invalid Payment Link'}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {errorMsg || 'This payment link is not valid. Ask the academy for a new link.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Header / Payee Name */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>UPI Payment</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white pt-2 break-words">
                {paymentData.payee_name}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 break-words">
                {paymentData.note}
              </p>
            </div>

            {/* Prominent Amount Box */}
            <div className="bg-slate-50 dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a] rounded-xl p-5 text-center space-y-2">
              <p className="text-xs uppercase font-medium tracking-wider text-slate-500 dark:text-slate-400">
                Amount to Pay
              </p>
              <div className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight">
                {formattedAmount}
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 pt-1">
                Make sure the amount in your UPI app matches {formattedAmount}.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Confirm the amount in your UPI app before paying.
              </p>
            </div>

            {/* Prominent UPI ID Verification Section */}
            <div className="space-y-2 text-center">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Check that this UPI ID is the one you know for {paymentData.payee_name} before you pay.
              </p>
              <div className="inline-block px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-sm font-bold text-slate-900 dark:text-slate-100 break-all select-all">
                {paymentData.upi_id}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handlePayClick}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-base shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Pay {formattedAmount} with UPI
              </button>

              <button
                type="button"
                onClick={handleCopyUpi}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:bg-slate-100 text-slate-700 dark:text-slate-200 font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-slate-400"
              >
                {copiedUpi ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>UPI ID Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy UPI ID</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 pt-1">
                If nothing opens, copy the UPI ID and pay from your UPI app.
              </p>
            </div>

            {/* FEATURE A: Payment Screenshot Upload Section */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  After you pay, upload a screenshot of the payment confirmation.
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your screenshot is visible only to the academy and is deleted after the payment is recorded.
                </p>
              </div>

              {uploadSuccess ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5 text-emerald-800 dark:text-emerald-200">
                  <FileCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">
                    Thank you. The academy has received your screenshot.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <input
                      type="file"
                      id="payment-screenshot-input"
                      data-testid="payment-screenshot-input"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={isUploading}
                      onChange={handleFileChange}
                      className="block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-950/60 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/60 cursor-pointer disabled:opacity-50"
                    />
                    <p className="text-[11px] text-slate-400">
                      JPEG, PNG, or WebP up to 2 MB.
                    </p>
                  </div>

                  {uploadError && (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleUploadScreenshot}
                    disabled={!screenshotFile || isUploading}
                    data-testid="upload-screenshot-button"
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Uploading screenshot...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Submit Screenshot</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
