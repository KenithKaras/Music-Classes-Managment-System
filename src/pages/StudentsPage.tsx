import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Edit2,
  Trash2,
  ArrowRightLeft,
  User,
  Layers,
} from 'lucide-react';
import { getStudents, createStudent, updateStudent, deleteStudent, transferStudentBatch } from '../services/studentService';
import { getBatches } from '../services/batchService';
import type { Student, StudentFormData, Batch } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Badge } from '../components/Badge';
import { Table } from '../components/Table';
import { EmptyState } from '../components/EmptyState';
import { StudentFormModal } from '../components/StudentFormModal';
import { TransferBatchModal } from '../components/TransferBatchModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Tabs } from '../components/Tabs';
import { formatDisplayDate } from '../utils/formUtils';
import { useDebounce } from '../hooks/useDebounce';
import { queryClient } from '../lib/queryClient';

export const StudentsPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Server Search
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [transferStudent, setTransferStudent] = useState<Student | null>(null);

  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset to first page when search or filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, batchFilter]);

  // Load data
  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [studentsRes, batchesRes] = await Promise.all([
      getStudents({
        search: debouncedSearch,
        status: statusFilter,
        batchId: batchFilter,
        page,
        pageSize,
      }),
      getBatches(),
    ]);

    if (studentsRes.error) {
      setError(studentsRes.error);
    } else {
      setStudents(studentsRes.students);
      setTotalCount(studentsRes.totalCount);
    }

    if (batchesRes.batches) {
      setBatches(batchesRes.batches);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, statusFilter, batchFilter]);

  // Handle Search Debounce / Submit
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Add / Edit submission
  const handleFormSubmit = async (formData: StudentFormData): Promise<boolean> => {
    if (editingStudent) {
      const res = await updateStudent(editingStudent.id, formData);
      if (res.error) {
        alert(`Failed to update student: ${res.error}`);
        return false;
      }
    } else {
      const res = await createStudent(formData);
      if (res.error) {
        alert(`Failed to create student: ${res.error}`);
        return false;
      }
    }

    setIsFormModalOpen(false);
    setEditingStudent(null);
    queryClient.invalidateQueries({ queryKey: ['students'] });
    await loadData();
    return true;
  };

  // Delete student
  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    const res = await deleteStudent(studentToDelete.id, studentToDelete.photo_url);
    setIsDeleting(false);

    if (res.error) {
      alert(`Failed to delete student: ${res.error}`);
    } else {
      setStudentToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      await loadData();
    }
  };

  // Transfer batch
  const handleTransferBatch = async (studentId: string, newBatchId: string | null): Promise<boolean> => {
    const res = await transferStudentBatch(studentId, newBatchId);
    if (res.error) {
      alert(`Failed to transfer batch: ${res.error}`);
      return false;
    }
    queryClient.invalidateQueries({ queryKey: ['students'] });
    await loadData();
    return true;
  };

  const batchFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Batches' },
      { value: 'no-batch', label: 'Without a Batch (Unassigned)' },
      ...batches.map((b) => ({ value: b.id, label: b.name })),
    ],
    [batches]
  );

  return (
    <div className="space-y-6">
      {/* Header and Sub-Navigation Tabs */}
      <div className="bg-white dark:bg-[#111a2b] rounded-xl border border-slate-200 dark:border-[#1f2a3d] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Students &amp; Batches
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage student enrollment, contact records, fee assignments, and batch allocations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setEditingStudent(null);
                setIsFormModalOpen(true);
              }}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Student
            </Button>
          </div>
        </div>

        {/* Sub-Tabs: Students vs Batches */}
        <div className="mt-6">
          <Tabs
            tabs={[
              { id: 'students', label: `Students (${students.length})`, to: '/students', icon: Users },
              { id: 'batches', label: `Batches (${batches.length})`, to: '/batches', icon: Layers },
            ]}
          />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#111a2b] rounded-xl border border-slate-200 dark:border-[#1f2a3d] p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-5">
            <Input
              type="search"
              placeholder="Search by student name or phone..."
              value={search}
              onChange={handleSearchChange}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="sm:col-span-3">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'active', label: 'Active Students' },
                { value: 'inactive', label: 'Inactive Students' },
              ]}
            />
          </div>

          <div className="sm:col-span-3">
            <Select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              options={batchFilterOptions}
            />
          </div>

          <div className="sm:col-span-1">
            <Button type="submit" variant="secondary" className="w-full">
              Search
            </Button>
          </div>
        </form>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          <p className="font-semibold">Error Loading Students</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="bg-white dark:bg-[#111a2b] rounded-xl border border-slate-200 dark:border-[#1f2a3d] p-12 text-center">
          <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-700 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading student roster...</p>
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          description={
            search || statusFilter !== 'all' || batchFilter !== 'all'
              ? 'No students matched your search and filter criteria. Try adjusting your filters.'
              : 'You have not enrolled any students yet. Get started by adding your first student.'
          }
          actionText={
            search || statusFilter !== 'all' || batchFilter !== 'all'
              ? 'Clear Filters'
              : 'Add Student'
          }
          actionIcon={<Plus className="w-4 h-4" />}
          onAction={() => {
            if (search || statusFilter !== 'all' || batchFilter !== 'all') {
              setSearch('');
              setStatusFilter('all');
              setBatchFilter('all');
            } else {
              setEditingStudent(null);
              setIsFormModalOpen(true);
            }
          }}
        />
      ) : (
        <>
          {/* Desktop Table View (hidden on small screens) */}
          <div className="hidden md:block">
            <Table>
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Student</th>
                  <th scope="col" className="px-6 py-3.5">Phone &amp; Email</th>
                  <th scope="col" className="px-6 py-3.5">Batch</th>
                  <th scope="col" className="px-6 py-3.5">Monthly Fee</th>
                  <th scope="col" className="px-6 py-3.5">Status</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#111a2b]">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Student Avatar & Name */}
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

                    {/* Contact */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <div>
                        <div className="flex items-center gap-1.5 text-slate-900 font-medium">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{student.phone || 'No phone'}</span>
                        </div>
                        {student.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{student.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Batch */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {student.batch ? (
                        <div>
                          <span className="font-medium text-slate-900">{student.batch.name}</span>
                          <p className="text-xs text-slate-500">
                            {(student.batch.days_of_week || []).join(', ')} •{' '}
                            {student.batch.start_time?.substring(0, 5)} - {student.batch.end_time?.substring(0, 5)}
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-medium">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Fee */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                      ₹{student.monthly_fee}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        variant={student.status === 'active' ? 'success' : 'neutral'}
                        dot
                      >
                        {student.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTransferStudent(student)}
                          title="Transfer Batch"
                          aria-label="Transfer Batch"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStudent(student);
                            setIsFormModalOpen(true);
                          }}
                          title="Edit Student"
                          aria-label="Edit Student"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentToDelete(student)}
                          title="Delete Student"
                          aria-label="Delete Student"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Mobile Stacked Cards (Visible only on mobile, no horizontal scrolling) */}
          <div className="md:hidden space-y-3">
            {students.map((student) => (
              <div
                key={student.id}
                className="bg-white dark:bg-[#111a2b] rounded-xl border border-slate-200 dark:border-[#1f2a3d] p-4 shadow-2xs space-y-3"
              >
                {/* Header: Photo, Name, Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                      {student.photo_url ? (
                        <img
                          src={student.photo_url}
                          alt={student.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <Link
                        to={`/students/${student.id}`}
                        className="font-bold text-slate-900 dark:text-slate-100 text-base hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block"
                      >
                        {student.full_name}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Enrolled: {formatDisplayDate(student.enrollment_date)}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant={student.status === 'active' ? 'success' : 'neutral'}
                    dot
                  >
                    {student.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 font-medium block">Phone</span>
                    <span className="font-semibold text-slate-800">{student.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Monthly Fee</span>
                    <span className="font-semibold text-slate-900">₹{student.monthly_fee}</span>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="text-slate-400 font-medium block">Batch</span>
                    <span className="font-medium text-slate-800">
                      {student.batch ? (
                        `${student.batch.name} (${(student.batch.days_of_week || []).join(', ')})`
                      ) : (
                        <span className="text-amber-700">Unassigned (No Batch)</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Action Buttons (Large enough for touch targets) */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/students/${student.id}`)}
                    className="w-full"
                  >
                    Profile
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTransferStudent(student)}
                    icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                  >
                    Batch
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingStudent(student);
                      setIsFormModalOpen(true);
                    }}
                    icon={<Edit2 className="w-3.5 h-3.5" />}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStudentToDelete(student)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Server-side Range Pagination Controls */}
          {totalCount > 0 && (
            <div className="bg-white dark:bg-[#111a2b] rounded-xl border border-slate-200 dark:border-[#1f2a3d] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
              <div className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                Showing{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {(page - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {Math.min(page * pageSize, totalCount)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {totalCount}
                </span>{' '}
                students
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-[44px] min-w-[44px] px-3 font-medium disabled:opacity-50"
                  aria-label="Previous page"
                >
                  Previous
                </Button>
                <span className="px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                  Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page >= Math.ceil(totalCount / pageSize) || loading}
                  onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                  className="min-h-[44px] min-w-[44px] px-3 font-medium disabled:opacity-50"
                  aria-label="Next page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Student Form Modal (Add / Edit) */}
      <StudentFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingStudent(null);
        }}
        onSubmit={handleFormSubmit}
        student={editingStudent}
      />

      {/* Transfer Batch Modal */}
      <TransferBatchModal
        isOpen={Boolean(transferStudent)}
        onClose={() => setTransferStudent(null)}
        student={transferStudent}
        onTransfer={handleTransferBatch}
      />

      {/* Confirm Delete Dialog (Names student specifically) */}
      <ConfirmDialog
        isOpen={Boolean(studentToDelete)}
        onClose={() => setStudentToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Student Record"
        message={
          <>
            Are you sure you want to delete student{' '}
            <strong className="text-slate-900">&ldquo;{studentToDelete?.full_name}&rdquo;</strong>?
            This will permanently remove their profile, contact records, and photo. This action cannot be undone.
          </>
        }
        confirmText="Yes, Delete Student"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
};
