import React, { useState, useEffect } from 'react';
import { Download, Printer, CheckCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import type { Payment, AcademySettings } from '../types';
import { formatIndianCurrency, formatBillingMonth } from '../utils/feeUtils';
import { downloadReceiptPdf } from '../utils/receiptPdf';
import { getAcademySettings } from '../services/academyService';

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  balanceRemaining?: number;
  academySettings?: AcademySettings | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
  balanceRemaining = 0,
  academySettings: propSettings,
}) => {
  const [settings, setSettings] = useState<AcademySettings | null>(propSettings || null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!propSettings && isOpen) {
      getAcademySettings().then(({ settings: loaded }) => {
        if (loaded) setSettings(loaded);
      });
    } else if (propSettings) {
      setSettings(propSettings);
    }
  }, [propSettings, isOpen]);

  if (!payment) return null;

  const academyName = settings?.academy_name || 'MIX with Me Classes';
  const billingMonthStr = payment.monthly_fee?.billing_month
    ? formatBillingMonth(payment.monthly_fee.billing_month)
    : 'Music Class Fee';

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadReceiptPdf({
        payment,
        academySettings: settings,
        balanceRemaining,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Payment Receipt"
      description={`Receipt ${payment.receipt_number}`}
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Printable Receipt Card */}
        <div
          id="printable-receipt"
          className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs text-slate-800"
        >
          {/* Header */}
          <div className="text-center pb-4 border-b border-slate-200">
            {settings?.logo_url && (
              <img
                src={settings.logo_url}
                alt={academyName}
                className="w-14 h-14 object-contain mx-auto mb-2 rounded-lg border border-slate-200 p-0.5"
              />
            )}
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{academyName}</h2>
            <div className="text-xs text-slate-500 mt-1 space-x-2">
              {settings?.contact_number && <span>Ph: {settings.contact_number}</span>}
              {settings?.email && <span>• {settings.email}</span>}
              {settings?.address && <span>• {settings.address}</span>}
            </div>
          </div>

          {/* Badge & Meta */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-4 px-3 py-2 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Official Fee Receipt
              </span>
            </div>
            <div className="text-xs font-mono font-semibold text-indigo-700">
              {payment.receipt_number}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 mt-5 text-xs">
            <div>
              <p className="text-slate-400 font-medium">Student Name</p>
              <p className="font-semibold text-slate-900 text-sm mt-0.5">
                {payment.student?.full_name || 'N/A'}
              </p>
              {payment.student?.guardian_name && (
                <p className="text-slate-500 mt-0.5">
                  Guardian: {payment.student.guardian_name}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-slate-400 font-medium">Payment Date</p>
              <p className="font-semibold text-slate-900 text-sm mt-0.5">{payment.payment_date}</p>
              <p className="text-slate-500 mt-0.5 uppercase">
                Mode: {payment.method.replace('_', ' ')}
              </p>
            </div>
          </div>

          {/* Fee Breakdown Table */}
          <div className="mt-5 border border-slate-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <span>Description</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="grid grid-cols-2 px-4 py-2.5">
                <span className="text-slate-700 font-medium">
                  Monthly Fee ({billingMonthStr})
                </span>
                <span className="text-right font-medium text-slate-900">
                  {payment.monthly_fee?.amount_due !== undefined
                    ? formatIndianCurrency(payment.monthly_fee.amount_due)
                    : '-'}
                </span>
              </div>
              <div className="grid grid-cols-2 px-4 py-2.5 bg-indigo-50/50">
                <span className="font-bold text-indigo-900">Amount Paid</span>
                <span className="text-right font-bold text-indigo-900 text-sm">
                  {formatIndianCurrency(payment.amount)}
                </span>
              </div>
              <div className="grid grid-cols-2 px-4 py-2.5">
                <span className="text-slate-500">Remaining Balance</span>
                <span
                  className={`text-right font-semibold ${
                    balanceRemaining > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {balanceRemaining > 0
                    ? formatIndianCurrency(balanceRemaining)
                    : '₹0 (Paid in Full)'}
                </span>
              </div>
            </div>
          </div>

          {payment.notes && (
            <p className="mt-4 text-xs italic text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              Note: {payment.notes}
            </p>
          )}

          {/* Signatory */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex items-end justify-between text-[11px] text-slate-400">
            <div>
              <p>Generated electronically</p>
              <p>MIX with Me Classes</p>
            </div>
            <div className="text-right border-t border-slate-300 pt-1 w-32 text-center">
              <p className="text-slate-600 font-medium">Authorized Signatory</p>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handlePrint}
            icon={Printer}
          >
            Print
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={isDownloading}
              onClick={handleDownload}
              icon={Download}
            >
              Download PDF
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
