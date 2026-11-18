import React, { useState, useEffect } from 'react';
import { AlertCircle, DollarSign } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { CurrencyInput } from './CurrencyInput';
import type { Student } from '../types';
import { formatIndianCurrency, formatBillingMonth, getBillingMonthDateString } from '../utils/feeUtils';
import { updateStudentMonthlyFee } from '../services/feeService';

export interface ModifyStudentFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onSuccess: () => void;
}

export const ModifyStudentFeeModal: React.FC<ModifyStudentFeeModalProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess,
}) => {
  const [newFee, setNewFee] = useState<number>(0);
  const [updateCurrentMonth, setUpdateCurrentMonth] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentMonthLabel = formatBillingMonth(getBillingMonthDateString(new Date()));

  useEffect(() => {
    if (student && isOpen) {
      setNewFee(student.monthly_fee);
      setUpdateCurrentMonth(true);
      setErrorMessage(null);
    }
  }, [student, isOpen]);

  if (!student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newFee < 0) {
      setErrorMessage('Monthly fee cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { success, error } = await updateStudentMonthlyFee(
        student.id,
        newFee,
        updateCurrentMonth
      );

      if (!success || error) {
        setErrorMessage(error || 'Failed to update monthly fee');
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onClose();
      onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Modify Student Monthly Fee"
      description={`Update fee setting for ${student.full_name}`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
          <p className="text-slate-400 font-medium">Current Monthly Fee</p>
          <p className="text-lg font-bold text-slate-900 mt-0.5">
            {formatIndianCurrency(student.monthly_fee)}
          </p>
        </div>

        <div>
          <CurrencyInput
            label="New Monthly Fee"
            required
            value={newFee}
            onChange={(val) => {
              setNewFee(val);
              setErrorMessage(null);
            }}
            helperText="This fee will automatically apply to future generated months."
          />
        </div>

        <div className="pt-1">
          <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={updateCurrentMonth}
              onChange={(e) => setUpdateCurrentMonth(e.target.checked)}
              className="mt-0.5 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>
              Also apply this change to <strong>{currentMonthLabel}</strong>'s fee record (if
              already generated and not fully paid).
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={isSubmitting}
            icon={DollarSign}
          >
            Update Fee
          </Button>
        </div>
      </form>
    </Modal>
  );
};
