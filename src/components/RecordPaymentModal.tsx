import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Smartphone } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { CurrencyInput } from './CurrencyInput';
import type { MonthlyFee, Payment, PaymentMethod } from '../types';
import { formatIndianCurrency, formatBillingMonth } from '../utils/feeUtils';
import {
  recordPayment,
  checkRecentDuplicatePayment,
  checkDuplicateUpiTxnId,
} from '../services/paymentService';
import { validateUpiTxnId } from '../utils/upiUtils';
import { supabase } from '../lib/supabase';

export interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  fee: MonthlyFee | null;
  onSuccess: (payment: Payment) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  fee,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [upiTxnId, setUpiTxnId] = useState<string>('');
  const [isUpiConfirming, setIsUpiConfirming] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Duplicate payment warning state
  const [duplicateWarning, setDuplicateWarning] = useState<Payment | null>(null);

  // Reset form when fee changes or modal opens
  useEffect(() => {
    if (fee && isOpen) {
      const balance = fee.balance ?? Math.max(0, fee.amount_due - (fee.amount_paid || 0));
      setAmount(balance);
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setMethod('cash');
      setUpiTxnId('');
      setIsUpiConfirming(false);
      setNotes('');
      setErrorMessage(null);
      setDuplicateWarning(null);
    }
  }, [fee, isOpen]);

  if (!fee) return null;

  const currentBalance = fee.balance ?? Math.max(0, fee.amount_due - (fee.amount_paid || 0));
  const studentName = fee.student?.full_name || 'Student';
  const monthLabel = formatBillingMonth(fee.billing_month);
  const willBeStatus = (fee.amount_paid || 0) + amount >= fee.amount_due ? 'paid' : 'partially paid';

  const handleSubmit = async (
    e?: React.FormEvent,
    bypassDuplicateCheck = false,
    bypassUpiPrompt = false
  ) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!amount || amount <= 0) {
      setErrorMessage('Please enter a payment amount greater than ₹0.');
      return;
    }

    if (amount > currentBalance) {
      setErrorMessage(
        `Amount cannot exceed the remaining balance of ${formatIndianCurrency(currentBalance)}.`
      );
      return;
    }

    if (!paymentDate) {
      setErrorMessage('Please select a payment date.');
      return;
    }

    // UPI-specific validations
    let cleanedUtr: string | undefined = undefined;
    if (method === 'upi') {
      const utrValidation = validateUpiTxnId(upiTxnId);
      if (!utrValidation.isValid) {
        setErrorMessage(utrValidation.error || 'Please enter a valid UPI Transaction ID (UTR).');
        return;
      }
      cleanedUtr = utrValidation.formatted;

      setIsSubmitting(true);
      const dupUtrCheck = await checkDuplicateUpiTxnId(cleanedUtr);
      if (dupUtrCheck.isDuplicate) {
        setErrorMessage(
          `This transaction ID is already recorded for ${dupUtrCheck.studentName || 'another student'}.`
        );
        setIsSubmitting(false);
        return;
      }

      // Prompt before saving for UPI
      if (!bypassUpiPrompt) {
        setIsSubmitting(false);
        setIsUpiConfirming(true);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // 1. Check for duplicates within last 60 seconds unless admin confirmed bypass
      if (!bypassDuplicateCheck) {
        const { isDuplicate, recentPayment } = await checkRecentDuplicatePayment(
          fee.student_id,
          amount,
          paymentDate
        );

        if (isDuplicate && recentPayment) {
          setDuplicateWarning(recentPayment);
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Record payment
      const { payment, error } = await recordPayment({
        student_id: fee.student_id,
        monthly_fee_id: fee.id,
        amount,
        payment_date: paymentDate,
        method,
        upi_txn_id: cleanedUtr,
        notes,
      });

      if (error || !payment) {
        setErrorMessage(error || 'Failed to record payment');
        setIsSubmitting(false);
        return;
      }

      // Mark any pending screenshots for this fee as reviewed
      try {
        const { data: links } = await supabase
          .from('payment_links')
          .select('id')
          .eq('monthly_fee_id', fee.id);
        if (links && links.length > 0) {
          const linkIds = links.map((l: { id: string }) => l.id);
          await supabase
            .from('payment_screenshots')
            .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
            .in('payment_link_id', linkIds)
            .eq('status', 'pending');
        }
      } catch (markErr) {
        // Non-blocking: fee payment was recorded successfully
        if (import.meta.env.DEV) {
          console.warn('Could not mark payment screenshot as reviewed:', markErr);
        }
      }

      // Success
      setIsSubmitting(false);
      setIsUpiConfirming(false);
      onClose();
      onSuccess(payment);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Fee Payment"
      description={`Record payment for ${studentName} for ${monthLabel}`}
      maxWidth="md"
    >
      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4" noValidate>
        {/* Fee Summary Banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-slate-400 font-medium">Total Fee</p>
              <p className="font-semibold text-slate-900 text-sm mt-0.5">
                {formatIndianCurrency(fee.amount_due)}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Already Paid</p>
              <p className="font-semibold text-emerald-600 text-sm mt-0.5">
                {formatIndianCurrency(fee.amount_paid || 0)}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Balance Due</p>
              <p className="font-bold text-indigo-600 text-sm mt-0.5">
                {formatIndianCurrency(currentBalance)}
              </p>
            </div>
          </div>
        </div>

        {/* Duplicate Payment Warning Banner */}
        {duplicateWarning && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-amber-900 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Potential Duplicate Payment</p>
                <p className="mt-1">
                  A payment of <strong>{formatIndianCurrency(duplicateWarning.amount)}</strong> was already
                  recorded for this student less than a minute ago (Receipt: {duplicateWarning.receipt_number}).
                </p>
                <p className="mt-1 text-amber-800">
                  Are you sure you want to record another payment of the same amount?
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    loading={isSubmitting}
                    onClick={() => handleSubmit(undefined, true, true)}
                  >
                    Yes, Confirm & Record
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setDuplicateWarning(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* UPI Receipt Verification Confirmation Banner */}
        {isUpiConfirming && (
          <div className="bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 rounded-xl p-3.5 text-xs text-indigo-900 dark:text-indigo-200 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Verify UPI Payment</p>
                <p className="mt-1">
                  Confirm you have received <strong>{formatIndianCurrency(amount)}</strong> in your UPI app. This will mark the fee as <strong>{willBeStatus}</strong>.
                </p>
                <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300 font-mono">
                  UTR: {upiTxnId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="primary"
                loading={isSubmitting}
                onClick={() => handleSubmit(undefined, true, true)}
              >
                Yes, Received &amp; Record
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => setIsUpiConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Payment Amount */}
        <div>
          <CurrencyInput
            label="Payment Amount"
            required
            value={amount}
            onChange={(val) => {
              setAmount(val);
              setErrorMessage(null);
              setDuplicateWarning(null);
            }}
            helperText={`Max payable: ${formatIndianCurrency(currentBalance)}`}
          />
        </div>

        {/* Quick Amount Fill Buttons if partial balance */}
        {currentBalance > 0 && amount !== currentBalance && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAmount(currentBalance)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
            >
              Pay Full Balance ({formatIndianCurrency(currentBalance)})
            </button>
          </div>
        )}

        {/* Payment Date */}
        <div>
          <Input
            label="Payment Date"
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </div>

        {/* Payment Method */}
        <div>
          <Select
            label="Payment Method"
            required
            value={method}
            onChange={(e) => {
              setMethod(e.target.value as PaymentMethod);
              setErrorMessage(null);
              setIsUpiConfirming(false);
            }}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'upi', label: 'UPI (GPay / PhonePe / Paytm)' },
              { value: 'bank_transfer', label: 'Bank Transfer (NEFT / IMPS)' },
              { value: 'card', label: 'Debit / Credit Card' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>

        {/* UPI Transaction ID / UTR */}
        {method === 'upi' && (
          <div>
            <Input
              label="UPI Transaction ID (UTR)"
              required
              value={upiTxnId}
              onChange={(e) => {
                setUpiTxnId(e.target.value.toUpperCase().trim());
                setErrorMessage(null);
                setIsUpiConfirming(false);
              }}
              placeholder="e.g. 334455667788"
              helperText="6 to 35 alphanumeric characters from the student's UPI payment receipt."
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. UPI ref no, cheque number, or special note"
            className="block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] placeholder-[var(--input-placeholder)] px-3 py-2 text-sm transition-colors focus-visible:border-indigo-600 dark:focus-visible:border-indigo-400"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting || !!duplicateWarning || isUpiConfirming}
            icon={CheckCircle2}
          >
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
