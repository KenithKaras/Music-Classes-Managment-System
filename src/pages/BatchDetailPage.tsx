import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  ArrowRightLeft,
  User,
  Plus,
} from 'lucide-react';
import { getBatchById, updateBatch, deleteBatch } from '../services/batchService';
import { transferStudentBatch } from '../services/studentService';
import type { Batch, BatchFormData, Student } from '../types';
import { formatDisplayDate } from '../utils/formUtils';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Table } from '../components/Table';
import { EmptyState } from '../components/EmptyState';
import { BatchFormModal } from '../components/BatchFormModal';
import { TransferBatchModal } from '../components/TransferBatchModal';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const BatchDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [transferStudent, setTransferStudent] = useState<Student | null>(null);

  const loadBatchDetails = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const res = await getBatchById(id);
    if (res.error) {
      setError(res.error);
    } else {
      setBatch(res.batch);
      setStudents(res.students);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBatchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleEditSubmit = async (formData: BatchFormData): Promise<boolean> => {
    if (!id) return false;
    const res = await updateBatch(id, formData);
    if (res.error) {
      alert(res.error);
      return false;
    }
    await loadBatchDetails();
    return true;
  };

  const handleDeleteConfirm = async () => {
    if (!id) return;
    setIsDeleting(true);
    const res = await deleteBatch(id);
    setIsDeleting(false);

    if (res.error) {
      alert(`Failed to delete batch: ${res.error}`);
    } else {
      navigate('/batches', { replace: true });
    }
  };

  const handleTransferBatch = async (studentId: string, newBatchId: string | null): Promise<boolean> => {
    const res = await transferStudentBatch(studentId, newBatchId);
    if (res.error) {
      alert(`Failed to transfer student: ${res.error}`);
      return false;
    }
    await loadBatchDetails();
    return true;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-12 text-center">
        <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-700 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading batch details...</p>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="space-y-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate('/batches')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Batches
        </Button>
        <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-8 text-center">
          <p className="text-red-600 dark:text-red-400 font-semibold mb-2">Batch Not Found</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error || 'This batch does not exist.'}</p>
        </div>
      </div>
    );
  }

  const isAtCapacity = batch.capacity !== null && students.length >= batch.capacity;

  return (
    <div className="space-y-6">
      {/* Back button and quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate('/batches')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Batches List
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            icon={<Edit2 className="w-3.5 h-3.5" />}
          >
            Edit Schedule
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
            icon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete Batch
          </Button>
        </div>
      </div>

      {/* Batch Overview Header Card */}
      <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {batch.name}
              </h1>
              {batch.capacity ? (
                <Badge variant={isAtCapacity ? 'warning' : 'neutral'} dot>
                  {isAtCapacity ? 'Capacity Reached' : 'Seats Available'}
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                {(batch.days_of_week || []).join(', ')}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                {batch.start_time?.substring(0, 5)} - {batch.end_time?.substring(0, 5)}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a] text-left sm:text-right shrink-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Enrolled Students</span>
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {students.length}
              {batch.capacity ? ` / ${batch.capacity} seats` : ' students'}
            </span>
          </div>
        </div>
      </div>

      {/* Students in Batch Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            Enrolled Students ({students.length})
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/students')}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Assign More Students
          </Button>
        </div>

        {students.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students in this batch"
            description="There are currently no students enrolled in this batch schedule. You can assign students from the Students list."
            actionText="Go to Students"
            onAction={() => navigate('/students')}
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <thead className="bg-slate-50 dark:bg-[#1a2540] text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">Student</th>
                    <th scope="col" className="px-6 py-3.5">Phone</th>
                    <th scope="col" className="px-6 py-3.5">Monthly Fee</th>
                    <th scope="col" className="px-6 py-3.5">Status</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#26324a] bg-white dark:bg-[#131c2e]">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                            {student.photo_url ? (
                              <img
                                src={student.photo_url}
                                alt={student.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <Link
                              to={`/students/${student.id}`}
                              className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                              {student.full_name}
                            </Link>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Enrolled: {formatDisplayDate(student.enrollment_date)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300 font-medium">
                        {student.phone || '—'}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-slate-100">
                        ₹{student.monthly_fee}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant={student.status === 'active' ? 'success' : 'neutral'}
                          dot
                        >
                          {student.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setTransferStudent(student)}
                            icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                          >
                            Transfer
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/students/${student.id}`)}
                          >
                            Profile
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="md:hidden space-y-3">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-4 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                        {student.photo_url ? (
                          <img
                            src={student.photo_url}
                            alt={student.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <Link
                          to={`/students/${student.id}`}
                          className="font-bold text-slate-900 dark:text-slate-100 text-sm hover:text-indigo-600 dark:hover:text-indigo-400 block"
                        >
                          {student.full_name}
                        </Link>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{student.phone || 'No phone'}</p>
                      </div>
                    </div>

                    <Badge
                      variant={student.status === 'active' ? 'success' : 'neutral'}
                      size="sm"
                      dot
                    >
                      {student.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-[#26324a] flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setTransferStudent(student)}
                      className="flex-1"
                      icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                    >
                      Transfer
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/students/${student.id}`)}
                      className="flex-1"
                    >
                      Profile
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Edit Batch Modal */}
      <BatchFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        batch={batch}
      />

      {/* Transfer Batch Modal */}
      <TransferBatchModal
        isOpen={Boolean(transferStudent)}
        onClose={() => setTransferStudent(null)}
        student={transferStudent}
        onTransfer={handleTransferBatch}
      />

      {/* Confirm Delete Batch Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Batch Schedule"
        message={
          <>
            Are you sure you want to delete batch{' '}
            <strong className="text-slate-900">&ldquo;{batch.name}&rdquo;</strong>?
            {students.length > 0 && (
              <span className="block mt-2 font-medium text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Notice: All {students.length} student(s) currently enrolled in this batch will be unassigned (batch set to &lsquo;None&rsquo;). The students will NOT be deleted.
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
