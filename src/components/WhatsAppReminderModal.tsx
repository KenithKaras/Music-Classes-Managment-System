import React, { useState, useEffect } from 'react';
import { ExternalLink, Copy, Check, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import type { MonthlyFee, Student, AcademySettings } from '../types';
import {
  cleanIndianPhoneForWhatsApp,
  buildWhatsAppReminderMessage,
  buildWhatsAppUrl,
  formatBillingMonth,
  formatIndianCurrency,
} from '../utils/feeUtils';
import { getAcademySettings } from '../services/academyService';

export interface WhatsAppReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  fee: MonthlyFee | null;
  student?: Student | null;
  academySettings?: AcademySettings | null;
}

export const WhatsAppReminderModal: React.FC<WhatsAppReminderModalProps> = ({
  isOpen,
  onClose,
  fee,
  student: propStudent,
  academySettings: propSettings,
}) => {
  const [settings, setSettings] = useState<AcademySettings | null>(propSettings || null);
  const [message, setMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const effectiveStudent = propStudent || fee?.student || null;

  useEffect(() => {
    if (!propSettings && isOpen) {
      getAcademySettings().then(({ settings: loaded }) => {
        if (loaded) setSettings(loaded);
      });
    } else if (propSettings) {
      setSettings(propSettings);
    }
  }, [propSettings, isOpen]);

  useEffect(() => {
    if (isOpen && effectiveStudent) {
      const balance = fee?.balance ?? Math.max(0, (fee?.amount_due || 0) - (fee?.amount_paid || 0));
      const monthName = fee?.billing_month
        ? formatBillingMonth(fee.billing_month)
        : formatBillingMonth(new Date().toISOString().split('T')[0]);
      const dueDateStr = fee?.due_date || new Date().toISOString().split('T')[0];

      const initialText = buildWhatsAppReminderMessage({
        studentName: effectiveStudent.full_name,
        guardianName: effectiveStudent.guardian_name,
        balance,
        monthName,
        dueDateStr,
        academyName: settings?.academy_name || 'MIX with Me Classes',
      });

      setMessage(initialText);
      setCopied(false);
    }
  }, [isOpen, effectiveStudent, fee, settings]);

  if (!effectiveStudent) return null;

  // Determine phone to use: guardian_phone prioritized over student.phone
  const rawPhone = effectiveStudent.guardian_phone || effectiveStudent.phone || '';
  const cleanedPhone12Digits = cleanIndianPhoneForWhatsApp(rawPhone);
  const isPhoneValid = !!cleanedPhone12Digits;

  const currentBalance = fee?.balance ?? Math.max(0, (fee?.amount_due || 0) - (fee?.amount_paid || 0));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleOpenWhatsApp = () => {
    if (!cleanedPhone12Digits) return;
    const url = buildWhatsAppUrl(cleanedPhone12Digits, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send WhatsApp Reminder"
      description={`Send fee reminder to ${effectiveStudent.full_name}'s contact`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Recipient summary banner */}
        <div className="bg-slate-50 dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a] rounded-xl p-3 text-xs space-y-1.5 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-[#a9b4c7]">Student:</span>
            <span className="font-semibold text-slate-900 dark:text-[#f1f5f9]">{effectiveStudent.full_name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-[#a9b4c7]">Recipient Contact:</span>
            <span className="font-medium text-slate-800 dark:text-[#f1f5f9]">
              {effectiveStudent.guardian_name
                ? `${effectiveStudent.guardian_name} (Guardian)`
                : 'Student Directly'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-[#a9b4c7]">Phone Number:</span>
            <span className={`font-mono font-medium ${isPhoneValid ? 'text-slate-800 dark:text-[#f1f5f9]' : 'text-rose-600 dark:text-rose-400'}`}>
              {rawPhone || 'Not provided'}
              {cleanedPhone12Digits && ` (+${cleanedPhone12Digits})`}
            </span>
          </div>
          {fee && (
            <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-[#26324a]">
              <span className="text-slate-500 dark:text-[#a9b4c7]">Pending Balance:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{formatIndianCurrency(currentBalance)}</span>
            </div>
          )}
        </div>

        {/* Warning if phone invalid */}
        {!isPhoneValid && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-2 text-rose-800 dark:text-rose-200 text-xs transition-colors">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="font-semibold">No valid 10-digit Indian phone number</p>
              <p className="mt-0.5">
                The student or guardian does not have a valid Indian mobile number starting with 6, 7, 8, or 9.
                Please update their phone number in the student profile before sending via WhatsApp.
              </p>
            </div>
          </div>
        )}

        {/* Editable Message Area */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="reminder-msg" className="block text-sm font-medium text-slate-700 dark:text-[#f1f5f9]">
              Message Preview (Editable)
            </label>
            <span className="text-xs text-slate-400 dark:text-[#a9b4c7]">{message.length} chars</span>
          </div>
          <textarea
            id="reminder-msg"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your WhatsApp reminder message..."
            className="block w-full rounded-xl border border-slate-300 dark:border-[#26324a] bg-white dark:bg-slate-900 dark:bg-[#1a2540] p-3 text-sm text-slate-900 dark:text-[#f1f5f9] placeholder:text-slate-400 dark:placeholder:text-[#a9b4c7] focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent font-sans transition-colors shadow-2xs"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-[#a9b4c7]">
            You can customize this message before opening WhatsApp.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100 dark:border-[#26324a] w-full">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            icon={copied ? Check : Copy}
            className="min-h-[44px] w-full sm:w-auto"
          >
            {copied ? 'Copied' : 'Copy Text'}
          </Button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} className="min-h-[44px] w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!isPhoneValid || !message.trim()}
              onClick={handleOpenWhatsApp}
              icon={ExternalLink}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 focus:ring-emerald-500 min-h-[44px] min-w-[44px] w-full sm:w-auto"
            >
              Open WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
