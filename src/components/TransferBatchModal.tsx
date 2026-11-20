import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Select } from './Select';
import { Button } from './Button';
import { getBatches } from '../services/batchService';
import type { Batch, Student } from '../types';
import { AlertTriangle, ArrowRightLeft } from 'lucide-react';

interface TransferBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onTransfer: (studentId: string, newBatchId: string | null) => Promise<boolean>;
}

export const TransferBatchModal: React.FC<TransferBatchModalProps> = ({
  isOpen,
  onClose,
  student,
  onTransfer,
}) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [targetBatchId, setTargetBatchId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !student) return;

    getBatches().then(({ batches }) => {
      setBatches(batches);
    });

    setTargetBatchId(student.batch_id || '');
  }, [isOpen, student]);

  if (!student) return null;

  const currentBatch = batches.find((b) => b.id === student.batch_id);
  const selectedBatch = batches.find((b) => b.id === targetBatchId);

  // Check if selected batch is at capacity
  const isTargetAtCapacity =
    selectedBatch &&
    selectedBatch.capacity !== null &&
    (selectedBatch.student_count ?? 0) >= selectedBatch.capacity &&
    selectedBatch.id !== student.batch_id;

  const handleConfirmTransfer = async () => {
    setIsSubmitting(true);
    const success = await onTransfer(student.id, targetBatchId || null);
    setIsSubmitting(false);

    if (success) {
      onClose();
    }
  };

  const batchOptions = [
    { value: '', label: 'No Batch (Unassigned)' },
    ...batches.map((b) => {
      const isFull = b.capacity !== null && (b.student_count ?? 0) >= b.capacity;
      return {
        value: b.id,
        label: `${b.name} (${(b.days_of_week || []).join(', ')}) • ${b.student_count ?? 0}${
          b.capacity ? `/${b.capacity}` : ''
        }${isFull ? ' [FULL]' : ''}`,
      };
    }),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer Student to Another Batch"
      description={`Move ${student.full_name} to a different scheduled batch.`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Current Batch Info */}
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Current Assignment:</span>
            <span className="font-semibold text-slate-900">
              {currentBatch ? currentBatch.name : 'No Batch (Unassigned)'}
            </span>
          </div>
        </div>

        {/* Target Batch Dropdown */}
        <Select
          label="Select New Batch"
          value={targetBatchId}
          onChange={(e) => setTargetBatchId(e.target.value)}
          options={batchOptions}
        />

        {/* Capacity Warning Banner */}
        {isTargetAtCapacity && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">Batch Capacity Warning</p>
              <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                &ldquo;{selectedBatch?.name}&rdquo; is currently at full capacity (
                {selectedBatch?.student_count}/{selectedBatch?.capacity} students).
                Transferring this student will exceed the designated batch limit.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            type="button"
            variant={isTargetAtCapacity ? 'danger' : 'primary'}
            onClick={handleConfirmTransfer}
            loading={isSubmitting}
            icon={<ArrowRightLeft className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            {isTargetAtCapacity ? 'Transfer Anyway' : 'Confirm Transfer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
