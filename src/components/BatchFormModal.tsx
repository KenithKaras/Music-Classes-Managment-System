import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import type { Batch, BatchFormData, DayOfWeek } from '../types';

interface BatchFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: BatchFormData) => Promise<boolean>;
  batch?: Batch | null;
}

const ALL_DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const BatchFormModal: React.FC<BatchFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  batch,
}) => {
  const [name, setName] = useState('');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('17:00');
  const [capacity, setCapacity] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!isOpen) return;

    if (batch) {
      setName(batch.name || '');
      setSelectedDays((batch.days_of_week as DayOfWeek[]) || []);
      // Strip seconds if present e.g. "16:00:00" -> "16:00"
      setStartTime(batch.start_time?.substring(0, 5) || '16:00');
      setEndTime(batch.end_time?.substring(0, 5) || '17:00');
      setCapacity(batch.capacity ?? '');
      setErrors({});
    } else {
      setName('');
      setSelectedDays(['Mon', 'Wed', 'Fri']);
      setStartTime('16:00');
      setEndTime('17:00');
      setCapacity('');
      setErrors({});
    }
  }, [isOpen, batch]);

  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
    if (errors.days) {
      setErrors((prev) => ({ ...prev, days: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Batch name is required.';
    }

    if (selectedDays.length === 0) {
      newErrors.days = 'Please select at least one day of the week.';
    }

    if (!startTime) {
      newErrors.startTime = 'Start time is required.';
    }

    if (!endTime) {
      newErrors.endTime = 'End time is required.';
    } else if (startTime && endTime <= startTime) {
      newErrors.endTime = 'End time must be after start time.';
    }

    if (capacity !== '' && (isNaN(Number(capacity)) || Number(capacity) <= 0)) {
      newErrors.capacity = 'Capacity must be a positive integer.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const payload: BatchFormData = {
      name: name.trim(),
      days_of_week: selectedDays,
      start_time: startTime,
      end_time: endTime,
      capacity: capacity === '' ? null : Number(capacity),
    };

    setIsSubmitting(true);
    const success = await onSubmit(payload);
    setIsSubmitting(false);

    if (success) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={batch ? 'Edit Batch Schedule' : 'Create New Batch'}
      description="Define batch timing, recurrence schedule, and optional student seat capacity."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          label="Batch Name"
          name="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
          }}
          placeholder="e.g. Beginners Keyboard (Mon/Wed/Fri)"
          error={errors.name}
        />

        {/* Days of Week Checkboxes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Days of the Week <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {ALL_DAYS.map((day) => {
              const isSelected = selectedDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all text-center min-h-[40px] flex items-center justify-center ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/30'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          {errors.days && <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.days}</p>}
        </div>

        {/* Timing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Start Time"
            name="startTime"
            type="time"
            required
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              if (errors.startTime) setErrors((prev) => ({ ...prev, startTime: '' }));
            }}
            error={errors.startTime}
          />

          <Input
            label="End Time"
            name="endTime"
            type="time"
            required
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
              if (errors.endTime) setErrors((prev) => ({ ...prev, endTime: '' }));
            }}
            error={errors.endTime}
          />
        </div>

        {/* Capacity */}
        <div>
          <Input
            label="Max Student Capacity (Optional)"
            name="capacity"
            type="number"
            min="1"
            value={capacity}
            onChange={(e) => {
              const val = e.target.value === '' ? '' : Number(e.target.value);
              setCapacity(val);
              if (errors.capacity) setErrors((prev) => ({ ...prev, capacity: '' }));
            }}
            placeholder="e.g. 10 (Leave blank for unlimited capacity)"
            helperText="Leave empty if this batch has no maximum limit."
            error={errors.capacity}
          />
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting} className="w-full sm:w-auto">
            {batch ? 'Update Batch' : 'Create Batch'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
