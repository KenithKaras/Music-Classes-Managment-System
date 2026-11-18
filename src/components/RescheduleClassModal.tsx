import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Select } from './Select';
import { Button } from './Button';
import { rescheduleClass } from '../services/classService';
import { getBatches } from '../services/batchService';
import type { ClassSession, Batch, RescheduleClassFormData } from '../types';
import { AlertCircle, Calendar, Clock } from 'lucide-react';

interface RescheduleClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  classSession: ClassSession | null;
  onSuccess: () => void;
}

export const RescheduleClassModal: React.FC<RescheduleClassModalProps> = ({
  isOpen,
  onClose,
  classSession,
  onSuccess,
}) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [classDate, setClassDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [batchId, setBatchId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!isOpen || !classSession) return;

    getBatches().then(({ batches }) => {
      setBatches(batches);
    });

    setClassDate(classSession.class_date);
    setStartTime(classSession.start_time.substring(0, 5));
    setEndTime(classSession.end_time.substring(0, 5));
    setBatchId(classSession.batch_id);
    setErrorMessage(null);
    setErrors({});
  }, [isOpen, classSession]);

  if (!classSession) return null;

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};

    if (!classDate) {
      errs.classDate = 'Class date is required.';
    }

    if (!startTime) {
      errs.startTime = 'Start time is required.';
    }

    if (!endTime) {
      errs.endTime = 'End time is required.';
    } else if (startTime && endTime <= startTime) {
      errs.endTime = 'End time must be after start time.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validate()) return;

    const payload: RescheduleClassFormData = {
      class_date: classDate,
      start_time: startTime,
      end_time: endTime,
      batch_id: batchId,
    };

    setIsSubmitting(true);
    const res = await rescheduleClass(classSession.id, payload);
    setIsSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      onSuccess();
      onClose();
    }
  };

  const batchOptions = batches.map((b) => ({
    value: b.id,
    label: `${b.name} (${(b.days_of_week || []).join(', ')})`,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reschedule Class Session"
      description={`Modify the schedule or reassign batch for this class.`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Conflict / Error Banner */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs sm:text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Schedule Conflict</p>
              <p className="mt-0.5 text-red-800 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        <Select
          label="Batch"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          options={batchOptions}
          disabled={batches.length === 0}
        />

        <Input
          label="Class Date"
          type="date"
          required
          value={classDate}
          onChange={(e) => {
            setClassDate(e.target.value);
            if (errors.classDate) setErrors((prev) => ({ ...prev, classDate: '' }));
          }}
          leftIcon={<Calendar className="w-4 h-4" />}
          error={errors.classDate}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Time"
            type="time"
            required
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              if (errors.startTime) setErrors((prev) => ({ ...prev, startTime: '' }));
            }}
            leftIcon={<Clock className="w-4 h-4" />}
            error={errors.startTime}
          />

          <Input
            label="End Time"
            type="time"
            required
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
              if (errors.endTime) setErrors((prev) => ({ ...prev, endTime: '' }));
            }}
            leftIcon={<Clock className="w-4 h-4" />}
            error={errors.endTime}
          />
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Confirm Reschedule
          </Button>
        </div>
      </form>
    </Modal>
  );
};
