import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { cancelClass } from '../services/classService';
import type { ClassSession } from '../types';
import { AlertTriangle } from 'lucide-react';
import { formatTimeAmPm } from '../utils/attendanceUtils';

interface CancelClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  classSession: ClassSession | null;
  onSuccess: () => void;
}

export const CancelClassModal: React.FC<CancelClassModalProps> = ({
  isOpen,
  onClose,
  classSession,
  onSuccess,
}) => {
  const [cancelReason, setCancelReason] = useState('Teacher unavailable / holiday');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!classSession) return null;

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await cancelClass(classSession.id, cancelReason);
    setIsSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel Class Session"
      description="Cancelled classes remain visible in the schedule but free up your timetable from overlap checks."
      maxWidth="md"
    >
      <form onSubmit={handleCancelSubmit} className="space-y-4">
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Are you sure you want to cancel this class?</p>
            <p className="mt-1 text-amber-800">
              Batch: <strong>{classSession.batch?.name || 'Class'}</strong>
              <br />
              Date: <strong>{classSession.class_date}</strong> (
              {formatTimeAmPm(classSession.start_time)} - {formatTimeAmPm(classSession.end_time)})
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-800 text-xs border border-red-200">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="cancel-reason" className="block text-sm font-medium text-slate-700 mb-1.5">
            Cancellation Reason (Optional)
          </label>
          <input
            id="cancel-reason"
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Teacher unwell, Public Holiday, Studio maintenance"
            className="block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] placeholder-[var(--input-placeholder)] text-sm p-2.5 transition-colors focus-visible:border-indigo-600 dark:focus-visible:border-indigo-400"
          />
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Keep Class
          </Button>
          <Button type="submit" variant="danger" loading={isSubmitting}>
            Confirm Cancellation
          </Button>
        </div>
      </form>
    </Modal>
  );
};
