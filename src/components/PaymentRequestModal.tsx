import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Copy,
  Check,
  Download,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from './Modal';
import { Button } from './Button';
import { supabase } from '../lib/supabase';
import { getAcademySettings } from '../services/academyService';
import type { MonthlyFee, Student, AcademySettings } from '../types';
import { formatIndianCurrency, formatBillingMonth } from '../utils/feeUtils';
import {
  buildPaymentRequestWhatsAppUrl,
  cleanIndianPhoneNumber,
  isUpiIdAllowed,
} from '../utils/upiUtils';
import { downloadPaymentRequestPdf } from '../utils/paymentRequestPdf';

export interface PaymentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  fee: MonthlyFee | null;
  student?: Student | null;
  academySettings?: AcademySettings | null;
}

export const PaymentRequestModal: React.FC<PaymentRequestModalProps> = ({
  isOpen,
  onClose,
  fee,
  student,
  academySettings: propSettings,
}) => {
  const [settings, setSettings] = useState<AcademySettings | null>(propSettings || null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [signedPayUrl, setSignedPayUrl] = useState<string | null>(null);
  const [, setIsGeneratingSignedLink] = useState(false);

  const upiId = settings?.upi_id?.trim() || '';
  const isUpiConfigured = Boolean(upiId);
  const isUpiAllowed = isUpiConfigured && isUpiIdAllowed(upiId);
  const feeId = fee?.id;

  useEffect(() => {
    if (!propSettings && isOpen) {
      getAcademySettings().then(({ settings: loaded }) => {
        if (loaded) setSettings(loaded);
      });
    } else if (propSettings) {
      setSettings(propSettings);
    }
  }, [propSettings, isOpen]);

  // Invoke create-payment-link Edge Function for signed payment link
  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !feeId || !isUpiAllowed) {
      setSignedPayUrl(null);
      return;
    }

    async function fetchSignedLink() {
      setIsGeneratingSignedLink(true);
      try {
        const { data, error } = await supabase.functions.invoke('create-payment-link', {
          body: { fee_id: feeId },
        });
        if (isMounted) {
          if (!error && data?.url) {
            setSignedPayUrl(data.url);
          } else {
            setSignedPayUrl(null);
          }
        }
      } catch {
        if (isMounted) {
          setSignedPayUrl(null);
        }
      } finally {
        if (isMounted) {
          setIsGeneratingSignedLink(false);
        }
      }
    }

    fetchSignedLink();

    return () => {
      isMounted = false;
    };
  }, [isOpen, feeId, isUpiAllowed]);

  if (!fee) return null;

  const effectiveStudent = student || fee.student || {
    id: fee.student_id,
    full_name: 'Student',
    phone: null,
    guardian_phone: null,
  };

  const balanceDue = fee.balance ?? Math.max(0, fee.amount_due - (fee.amount_paid || 0));
  const studentName = effectiveStudent.full_name;
  const monthLabel = formatBillingMonth(fee.billing_month);
  const academyName = settings?.academy_name || 'MIX with Me Classes';
  const qrStoragePath = settings?.upi_qr_path || '';
  const qrUrl = qrStoragePath
    ? supabase.storage.from('academy-assets').getPublicUrl(qrStoragePath).data.publicUrl
    : '';

  // Per-academy signed payment URL returned by create-payment-link
  const effectivePayUrl = isUpiAllowed ? signedPayUrl : null;

  // Phone resolution
  const targetPhone =
    effectiveStudent.guardian_phone || effectiveStudent.phone || '';
  const cleanPhone = cleanIndianPhoneNumber(targetPhone);
  const isPhoneValid = Boolean(cleanPhone);

  const { url: waUrl } = buildPaymentRequestWhatsAppUrl({
    phone: targetPhone,
    studentName,
    balanceDue,
    upiId,
    dueDate: fee.due_date,
    academyName,
    paymentUrl: effectivePayUrl,
  });

  const handleCopyUpi = async () => {
    if (!upiId) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(upiId);
      }
    } catch {
      // clipboard fallback
    } finally {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleCopyAmount = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(String(balanceDue));
      }
    } catch {
      // clipboard fallback
    } finally {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    if (!effectivePayUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(effectivePayUrl);
      }
    } catch {
      // clipboard fallback
    } finally {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadPaymentRequestPdf({
        studentName,
        billingMonth: fee.billing_month,
        balanceDue,
        dueDate: fee.due_date,
        academySettings: settings,
        upiId,
        paymentUrl: effectivePayUrl,
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!waUrl) return;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Payment Request"
      description={`Send UPI payment request to ${studentName} for ${monthLabel}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Unconfigured UPI State */}
        {!isUpiConfigured ? (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="font-semibold text-sm">UPI Not Configured</p>
            </div>
            <p>
              Set your UPI ID and QR in Settings first before sending payment requests.
            </p>
            <div className="pt-2">
              <Link
                to="/settings"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 text-xs transition-colors"
              >
                Go to Settings &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Request Summary Banner */}
            <div className="bg-slate-50 dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a] rounded-xl p-3.5 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-[#a9b4c7]">Academy:</span>
                <span className="font-semibold text-slate-900 dark:text-[#f1f5f9]">{academyName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-[#a9b4c7]">Student:</span>
                <span className="font-semibold text-slate-900 dark:text-[#f1f5f9]">{studentName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-[#a9b4c7]">Billing Month:</span>
                <span className="font-medium text-slate-800 dark:text-[#f1f5f9]">{monthLabel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-[#a9b4c7]">Due Date:</span>
                <span className="font-medium text-rose-600 dark:text-rose-400">{fee.due_date}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-[#26324a]">
                <span className="text-slate-600 dark:text-[#a9b4c7] font-medium">Balance Due:</span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                    {formatIndianCurrency(balanceDue)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAmount}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 dark:border-[#26324a] bg-white dark:bg-[#101726] text-[11px] font-medium text-slate-700 dark:text-[#f1f5f9] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    title="Copy exact amount"
                  >
                    {copiedAmount ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedAmount ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* QR Code and UPI ID Container */}
            <div className="bg-white dark:bg-[#101726] border border-slate-200 dark:border-[#26324a] rounded-xl p-4 text-center space-y-3">
              {qrUrl ? (
                <div className="inline-block p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <img
                    src={qrUrl}
                    alt="Academy UPI QR Code"
                    className="w-44 h-44 object-contain mx-auto"
                  />
                </div>
              ) : (
                <div className="w-44 h-44 mx-auto border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-400 text-xs">
                  <QrCode className="w-8 h-8 mb-1" />
                  <span>No QR image saved</span>
                </div>
              )}

              {/* UPI ID with Copy Button */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-[#f1f5f9] bg-slate-100 dark:bg-[#1a2540] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#26324a]">
                  {upiId}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyUpi}
                  icon={copiedUpi ? Check : Copy}
                  className="min-h-[38px]"
                >
                  {copiedUpi ? 'Copied' : 'Copy UPI ID'}
                </Button>
              </div>
            </div>

            {/* HTTPS Payment Link Container or Fallback */}
            {isUpiAllowed ? (
              effectivePayUrl && (
                <div className="bg-slate-50 dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a] rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-[#a9b4c7] uppercase tracking-wider">
                        Payment Link
                      </p>
                      <p
                        className="font-mono text-xs text-indigo-600 dark:text-indigo-400 truncate select-all"
                        data-testid="payment-link-url"
                      >
                        {effectivePayUrl}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={handleCopyLink}
                      icon={copiedLink ? Check : Copy}
                      className="min-h-[38px] shrink-0"
                    >
                      {copiedLink ? 'Copied' : 'Copy link'}
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <div className="bg-slate-50 dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a] rounded-xl p-3.5 text-center">
                <p className="text-xs text-slate-600 dark:text-[#a9b4c7]">
                  Payment link not available. Pay with the QR code or UPI ID above.
                </p>
              </div>
            )}

            {/* WhatsApp Attachment Warning Note */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl flex items-start gap-2.5 text-blue-900 dark:text-blue-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="font-semibold">Notice for WhatsApp</p>
                <p className="mt-0.5 text-blue-800 dark:text-blue-300">
                  WhatsApp cannot attach the QR automatically. Attach the downloaded PDF before sending.
                </p>
              </div>
            </div>

            {!isPhoneValid && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-2 text-amber-800 dark:text-amber-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <p>
                  No valid 10-digit Indian mobile number found for student or guardian. You can still download the PDF request.
                </p>
              </div>
            )}
          </>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-[#26324a]">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} className="min-h-[44px]">
            Close
          </Button>

          {isUpiConfigured && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={isDownloadingPdf}
                onClick={handleDownloadPdf}
                icon={Download}
                className="min-h-[44px]"
              >
                Download payment request (PDF)
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!isPhoneValid}
                onClick={handleOpenWhatsApp}
                icon={ExternalLink}
                className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 min-h-[44px]"
              >
                Open WhatsApp
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
