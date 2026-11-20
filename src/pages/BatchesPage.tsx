import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  Users,
  Plus,
  Clock,
  Calendar,
  Edit2,
  Trash2,
} from 'lucide-react';
import { getBatches, createBatch, updateBatch, deleteBatch } from '../services/batchService';
import type { Batch, BatchFormData } from '../types';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { BatchFormModal } from '../components/BatchFormModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Tabs } from '../components/Tabs';

export const BatchesPage: React.FC = () => {
  const navigate = useNavigate();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);

  const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadBatches = async () => {
    setLoading(true);
    setError(null);
    const res = await getBatches();
    if (res.error) {
      setError(res.error);
    } else {
      setBatches(res.batches);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleFormSubmit = async (formData: BatchFormData): Promise<boolean> => {
    if (editingBatch) {
      const res = await updateBatch(editingBatch.id, formData);
      if (res.error) {
        alert(res.error);
        return false;
      }
    } else {
      const res = await createBatch(formData);
      if (res.error) {
        alert(res.error);
        return false;
      }
    }
    await loadBatches();
    return true;
  };

  const handleDeleteConfirm = async () => {
    if (!batchToDelete) return;
    setIsDeleting(true);
    const res = await deleteBatch(batchToDelete.id);
    setIsDeleting(false);

    if (res.error) {
      alert(`Failed to delete batch: ${res.error}`);
    } else {
      setBatchToDelete(null);
      await loadBatches();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Sub-Navigation Tabs */}
      <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Students &amp; Batches
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure class schedules, batch timings, and monitor student seat capacities.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setEditingBatch(null);
                setIsFormModalOpen(true);
              }}
              icon={<Plus className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Add Batch
            </Button>
          </div>
        </div>

        {/* Sub-Tabs: Students vs Batches */}
        <div className="mt-6">
          <Tabs
            tabs={[
              { id: 'students', label: 'Students', to: '/students', icon: Users },
              { id: 'batches', label: `Batches (${batches.length})`, to: '/batches', icon: Layers },
            ]}
          />
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60 text-red-800 dark:text-rose-200 text-sm">
          <p className="font-semibold">Error Loading Batches</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-12 text-center">
          <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-700 border-t-slate-800 dark:border-t-slate-200 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading batch schedules...</p>
        </div>
      ) : batches.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No batches created yet"
          description="Create your first batch schedule (e.g. Beginners Keyboard, Weekend Vocalists) to organize your music students."
          actionText="Create Batch"
          actionIcon={<Plus className="w-4 h-4" />}
          onAction={() => {
            setEditingBatch(null);
            setIsFormModalOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((batch) => {
            const count = batch.student_count ?? 0;
            const isAtCapacity = batch.capacity !== null && count >= batch.capacity;

            return (
              <div
                key={batch.id}
                className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div>
                  {/* Top Bar: Title & Capacity Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/batches/${batch.id}`}
                      className="font-bold text-slate-900 dark:text-slate-100 text-base hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block truncate"
                    >
                      {batch.name}
                    </Link>

                    {batch.capacity ? (
                      <Badge
                        variant={isAtCapacity ? 'warning' : 'neutral'}
                        size="sm"
                      >
                        {count}/{batch.capacity} seats
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        {count} enrolled
                      </Badge>
                    )}
                  </div>

                  {/* Schedule Details */}
                  <div className="mt-4 space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {(batch.days_of_week || []).join(', ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span>
                        {batch.start_time?.substring(0, 5)} - {batch.end_time?.substring(0, 5)}
                      </span>
                    </div>
                  </div>

                  {/* Capacity progress bar if capacity is specified */}
                  {batch.capacity && (
                    <div className="mt-4">
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${
                            isAtCapacity ? 'bg-amber-500' : 'bg-slate-800 dark:bg-slate-200'
                          }`}
                          style={{
                            width: `${Math.min(100, (count / batch.capacity) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/batches/${batch.id}`)}
                    className="text-slate-700 dark:text-slate-300"
                    icon={<Users className="w-3.5 h-3.5" />}
                  >
                    View Students
                  </Button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBatch(batch);
                        setIsFormModalOpen(true);
                      }}
                      title="Edit Batch"
                      aria-label="Edit Batch"
                      className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchToDelete(batch)}
                      title="Delete Batch"
                      aria-label="Delete Batch"
                      className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Batch Form Modal */}
      <BatchFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingBatch(null);
        }}
        onSubmit={handleFormSubmit}
        batch={editingBatch}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(batchToDelete)}
        onClose={() => setBatchToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Batch Schedule"
        message={
          <>
            Are you sure you want to delete batch{' '}
            <strong className="text-slate-900">&ldquo;{batchToDelete?.name}&rdquo;</strong>?
            {batchToDelete && (batchToDelete.student_count ?? 0) > 0 && (
              <span className="block mt-2 font-medium text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Notice: All {batchToDelete.student_count} student(s) currently enrolled in this batch will be unassigned (batch set to &lsquo;None&rsquo;). The students will NOT be deleted.
              </span>
            )}
          </>
        }
        confirmText="Yes, Delete Batch"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
};
