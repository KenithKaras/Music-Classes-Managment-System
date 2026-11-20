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
  Layers,
  Send,
  Camera,
  RefreshCw,
} from 'lucide-react';
import { getStudents, createStudent, updateStudent, deleteStudent, transferStudentBatch } from '../services/studentService';
import { getBatches } from '../services/batchService';
import type { Student, StudentFormData, Batch, EnrollmentSubmission } from '../types';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Badge } from '../components/Badge';
import { Table } from '../components/Table';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { StudentFormModal } from '../components/StudentFormModal';
import { TransferBatchModal } from '../components/TransferBatchModal';
import { EnrollmentLinkModal } from '../components/EnrollmentLinkModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Tabs } from '../components/Tabs';
import { StudentAvatar } from '../components/StudentAvatar';
import {
  selectSubmissionsNeedingBackfill,
  copyEnrollmentPhotoToStudentPhotos,
} from '../utils/studentPhotoUtils';
import { formatDisplayDate } from '../utils/formUtils';
import { formatIndianCurrency } from '../utils/feeUtils';
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

  // Enrollment (Feature B) state
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState<EnrollmentSubmission[]>([]);
  const [allStudentsForBackfill, setAllStudentsForBackfill] = useState<Student[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<EnrollmentSubmission[]>([]);
  const [approvingSubmission, setApprovingSubmission] = useState<EnrollmentSubmission | null>(null);
  const [prefilledFormData, setPrefilledFormData] = useState<Partial<StudentFormData> | undefined>(undefined);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<string | null>(null);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [copyPhotoError, setCopyPhotoError] = useState<string | null>(null);
  const [isCopyingPhotoId, setIsCopyingPhotoId] = useState<string | null>(null);

  const [transferStudent, setTransferStudent] = useState<Student | null>(null);

  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Compute submissions needing photo backfill (pure selector)
  const backfillCandidates = useMemo(() => {
    return selectSubmissionsNeedingBackfill(allSubmissions, allStudentsForBackfill);
  }, [allSubmissions, allStudentsForBackfill]);

  const loadSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('enrollment_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        const subs = data as EnrollmentSubmission[];
        setAllSubmissions(subs);
        setPendingSubmissions(subs.filter((s) => s.status === 'pending'));
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('Error loading enrollment submissions:', err);
      }
    }
  };

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

    try {
      const { data: allStuds } = await supabase.from('students').select('*');
      if (allStuds) {
        setAllStudentsForBackfill(allStuds as Student[]);
      }
    } catch {
      // Fallback
    }

    await loadSubmissions();

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

      // If approving an enrollment submission, link it
      if (approvingSubmission && res.student) {
        try {
          await supabase
            .from('enrollment_submissions')
            .update({
              status: 'approved',
              student_id: res.student.id,
              reviewed_at: new Date().toISOString(),
            })
            .eq('id', approvingSubmission.id);
        } catch (subErr) {
          if (import.meta.env.DEV) {
            console.warn('Could not link submission to student:', subErr);
          }
        }
        setApprovingSubmission(null);
        setPrefilledFormData(undefined);
        await loadSubmissions();
      }
    }

    setIsFormModalOpen(false);
    setEditingStudent(null);
    queryClient.invalidateQueries({ queryKey: ['students'] });
    await loadData();
    return true;
  };

  const handleRunBackfill = async () => {
    if (isBackfilling || backfillCandidates.length === 0) return;
    setIsBackfilling(true);
    setBackfillProgress(`Copying 1 of ${backfillCandidates.length}...`);
    setBackfillResult(null);

    let copied = 0;
    const failedNames: string[] = [];

    for (let i = 0; i < backfillCandidates.length; i++) {
      const { submission, student } = backfillCandidates[i];
      setBackfillProgress(`Copying ${i + 1} of ${backfillCandidates.length}...`);

      // Never overwrite an existing student photo_url
      if (student.photo_url) {
        continue;
      }

      try {
        const { path, error } = await copyEnrollmentPhotoToStudentPhotos(submission.photo_path!);
        if (error || !path) {
          failedNames.push(student.full_name);
        } else {
          const { error: updateErr } = await supabase
            .from('students')
            .update({ photo_url: path })
            .eq('id', student.id);

          if (updateErr) {
            failedNames.push(student.full_name);
          } else {
            copied++;
          }
        }
      } catch {
        failedNames.push(student.full_name);
      }
    }

    setIsBackfilling(false);
    setBackfillProgress(null);

    const resultMsg = `Copied ${copied} photos. ${failedNames.length} failed.${
      failedNames.length > 0 ? ` Failed: ${failedNames.join(', ')}` : ''
    }`;
    setBackfillResult(resultMsg);

    queryClient.invalidateQueries({ queryKey: ['students'] });
    await loadData();
    await loadSubmissions();
  };

  const handleApproveSubmission = async (sub: EnrollmentSubmission) => {
    setCopyPhotoError(null);
    let copiedPhotoPath: string | null = null;

    if (sub.photo_path) {
      setIsCopyingPhotoId(sub.id);
      const { path, error } = await copyEnrollmentPhotoToStudentPhotos(sub.photo_path);
      setIsCopyingPhotoId(null);

      if (error || !path) {
        setCopyPhotoError('Could not copy the photo. Try again.');
        return;
      }
      copiedPhotoPath = path;
    }

    setApprovingSubmission(sub);
    setEditingStudent(null);
    const matchingBatch = batches.find(
      (b) => b.name.toLowerCase() === sub.preferred_batch?.toLowerCase()
    );
    setPrefilledFormData({
      full_name: sub.child_name,
      guardian_name: sub.parent_name,
      phone: sub.parent_phone,
      guardian_phone: sub.parent_phone,
      email: sub.parent_email || '',
      address: sub.address || '',
      batch_id: matchingBatch?.id || null,
      enrollment_date: new Date().toISOString().split('T')[0],
      photo_url: copiedPhotoPath,
    });
    setIsFormModalOpen(true);
  };

  const handleRejectSubmission = async (subId: string) => {
    if (!confirm('Are you sure you want to reject this registration?')) return;
    try {
      const { error } = await supabase
        .from('enrollment_submissions')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', subId);
      if (!error) {
        await loadSubmissions();
      } else {
        alert('Failed to reject registration: ' + error.message);
      }
    } catch {
      alert('Failed to reject registration.');
    }
  };

  const handleDeleteSubmission = async (sub: EnrollmentSubmission) => {
    if (!confirm(`Are you sure you want to delete registration for ${sub.child_name}?`)) return;
    try {
      if (sub.photo_path) {
        await supabase.storage.from('enrollment-photos').remove([sub.photo_path]);
      }
      const { error } = await supabase
        .from('enrollment_submissions')
        .delete()
        .eq('id', sub.id);
      if (!error) {
        await loadSubmissions();
      } else {
        alert('Failed to delete registration: ' + error.message);
      }
    } catch {
      alert('Failed to delete registration.');
    }
  };

  const handleRevokeSubmissionLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to revoke this registration link?')) return;
    try {
      const { error } = await supabase
        .from('enrollment_links')
        .update({ status: 'revoked' })
        .eq('id', linkId);
      if (!error) {
        alert('Registration link revoked.');
        await loadSubmissions();
      } else {
        alert('Failed to revoke link: ' + error.message);
      }
    } catch {
      alert('Failed to revoke link.');
    }
  };

  const handleViewPhoto = async (photoPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('enrollment-photos')
        .createSignedUrl(photoPath, 60);
      if (data?.signedUrl) {
        setViewingPhotoUrl(data.signedUrl);
      } else {
        alert('Could not view photo: ' + (error?.message || 'Unknown error'));
      }
    } catch {
      alert('Failed to view photo.');
    }
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
      <div className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#f1f5f9]">
              Students &amp; Batches
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#a9b4c7] mt-1">
              Manage student enrollment, contact records, fee assignments, and batch allocations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {backfillCandidates.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                disabled={isBackfilling}
                onClick={handleRunBackfill}
                icon={
                  isBackfilling ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )
                }
                className="w-full sm:w-auto text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
              >
                {isBackfilling ? backfillProgress || 'Copying...' : 'Copy registration photos'}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsLinkModalOpen(true)}
              icon={<Send className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Send registration form
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setApprovingSubmission(null);
                setPrefilledFormData(undefined);
                setEditingStudent(null);
                setIsFormModalOpen(true);
              }}
              icon={<Plus className="w-4 h-4" />}
              className="w-full sm:w-auto"
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

      {/* Backfill Result / Progress Banner */}
      {backfillResult && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between"
        >
          <span>{backfillResult}</span>
          <button
            type="button"
            onClick={() => setBackfillResult(null)}
            className="text-xs text-emerald-700 dark:text-emerald-400 font-medium hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Photo Copy Error Banner */}
      {copyPhotoError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between"
        >
          <span>{copyPhotoError}</span>
          <button
            type="button"
            onClick={() => setCopyPhotoError(null)}
            className="text-xs text-rose-700 dark:text-rose-400 font-medium hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pending Registrations Section (Feature B) */}
      {pendingSubmissions.length > 0 && (
        <div className="bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-600 animate-pulse" />
              <h3 className="text-sm sm:text-base font-semibold text-indigo-950 dark:text-indigo-200">
                Pending Registrations ({pendingSubmissions.length})
              </h3>
            </div>
            <span className="text-xs text-indigo-700 dark:text-indigo-400">
              Parent-submitted registrations waiting for approval
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingSubmissions.map((sub) => {
              const receivedTime = new Date(sub.created_at).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              });
              return (
                <div
                  key={sub.id}
                  className="bg-white dark:bg-[#131c2e] p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 flex flex-col justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <StudentAvatar
                          photoUrl={sub.photo_path}
                          name={sub.child_name}
                          bucket="enrollment-photos"
                          className="w-10 h-10"
                        />
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                            {sub.child_name}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Parent: {sub.parent_name} ({sub.parent_phone})
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    </div>

                    {sub.preferred_batch && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Batch:</span>{' '}
                        {sub.preferred_batch}
                      </p>
                    )}

                    {sub.address && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Address:</span>{' '}
                        {sub.address}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1">
                      <span>Received: {receivedTime}</span>
                      <div className="flex items-center gap-2">
                        {sub.photo_path && (
                          <button
                            type="button"
                            onClick={() => handleViewPhoto(sub.photo_path!)}
                            className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1"
                          >
                            <Camera className="w-3 h-3" />
                            Photo
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRevokeSubmissionLink(sub.enrollment_link_id)}
                          className="text-rose-500 hover:text-rose-700 hover:underline"
                          title="Revoke the registration link used for this registration"
                        >
                          Revoke Link
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      size="sm"
                      variant="primary"
                      className="flex-1 text-xs"
                      disabled={isCopyingPhotoId === sub.id}
                      onClick={() => handleApproveSubmission(sub)}
                    >
                      {isCopyingPhotoId === sub.id ? 'Copying photo...' : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs"
                      onClick={() => handleRejectSubmission(sub.id)}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs text-rose-600 hover:text-rose-700"
                      onClick={() => handleDeleteSubmission(sub)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-4 shadow-sm">
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
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm">
          <p className="font-semibold">Error Loading Students</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-12 text-center">
          <div className="w-8 h-8 border-2 border-slate-200 dark:border-[#26324a] border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-[#a9b4c7]">Loading student roster...</p>
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
              <thead className="bg-slate-50 dark:bg-[#1a2540] text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#a9b4c7]">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Student</th>
                  <th scope="col" className="px-6 py-3.5">Phone &amp; Email</th>
                  <th scope="col" className="px-6 py-3.5">Batch</th>
                  <th scope="col" className="px-6 py-3.5">Monthly Fee</th>
                  <th scope="col" className="px-6 py-3.5">Status</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#26324a] bg-white dark:bg-[#131c2e]">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-[#1a2540] transition-colors">
                    {/* Student Avatar & Name */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <StudentAvatar
                          photoUrl={student.photo_url}
                          name={student.full_name}
                          className="w-10 h-10"
                        />
                        <div>
                          <Link
                            to={`/students/${student.id}`}
                            className="font-semibold text-slate-900 dark:text-[#f1f5f9] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            {student.full_name}
                          </Link>
                          <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">
                            Enrolled: {formatDisplayDate(student.enrollment_date)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-[#a9b4c7]">
                      <div>
                        <div className="flex items-center gap-1.5 text-slate-900 dark:text-[#f1f5f9] font-medium">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{student.phone || 'No phone'}</span>
                        </div>
                        {student.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#a9b4c7] mt-0.5">
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
                          <span className="font-medium text-slate-900 dark:text-[#f1f5f9]">{student.batch.name}</span>
                          <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">
                            {(student.batch.days_of_week || []).join(', ')} &bull;{' '}
                            {student.batch.start_time?.substring(0, 5)} - {student.batch.end_time?.substring(0, 5)}
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60 font-medium">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Fee */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-[#f1f5f9]">
                      {formatIndianCurrency(student.monthly_fee)}
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
                          className="p-1.5 rounded-lg text-slate-500 dark:text-[#a9b4c7] hover:text-slate-900 dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-[#1a2540] min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
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
                          className="p-1.5 rounded-lg text-slate-500 dark:text-[#a9b4c7] hover:text-slate-900 dark:hover:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-[#1a2540] min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentToDelete(student)}
                          title="Delete Student"
                          aria-label="Delete Student"
                          className="p-1.5 rounded-lg text-slate-500 dark:text-[#a9b4c7] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
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
                className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-4 shadow-sm space-y-3"
              >
                {/* Header: Photo, Name, Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <StudentAvatar
                      photoUrl={student.photo_url}
                      name={student.full_name}
                      className="w-12 h-12"
                    />
                    <div>
                      <Link
                        to={`/students/${student.id}`}
                        className="font-bold text-slate-900 dark:text-[#f1f5f9] text-base hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block"
                      >
                        {student.full_name}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">
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
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-[#26324a]">
                  <div>
                    <span className="text-slate-400 dark:text-[#a9b4c7] font-medium block">Phone</span>
                    <span className="font-semibold text-slate-800 dark:text-[#f1f5f9]">{student.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-[#a9b4c7] font-medium block">Monthly Fee</span>
                    <span className="font-semibold text-slate-900 dark:text-[#f1f5f9]">{formatIndianCurrency(student.monthly_fee)}</span>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="text-slate-400 dark:text-[#a9b4c7] font-medium block">Batch</span>
                    <span className="font-medium text-slate-800 dark:text-[#f1f5f9]">
                      {student.batch ? (
                        `${student.batch.name} (${(student.batch.days_of_week || []).join(', ')})`
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">Unassigned (No Batch)</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-slate-100 dark:border-[#26324a] grid grid-cols-2 gap-2">
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
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
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
            <div className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="text-xs sm:text-sm font-medium text-slate-600 dark:text-[#a9b4c7]">
                Showing{' '}
                <span className="font-semibold text-slate-900 dark:text-[#f1f5f9]">
                  {(page - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-900 dark:text-[#f1f5f9]">
                  {Math.min(page * pageSize, totalCount)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-slate-900 dark:text-[#f1f5f9]">
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
                <span className="px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-[#a9b4c7]">
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
          setApprovingSubmission(null);
          setPrefilledFormData(undefined);
        }}
        onSubmit={handleFormSubmit}
        student={editingStudent}
        initialValues={prefilledFormData}
      />

      {/* Enrollment Link Modal (Feature B) */}
      <EnrollmentLinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
      />

      {/* Photo Preview Modal (Feature B) */}
      {viewingPhotoUrl && (
        <Modal
          isOpen={!!viewingPhotoUrl}
          onClose={() => setViewingPhotoUrl(null)}
          title="Student Photo"
          description="60-second secure temporary preview from private storage"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-center bg-slate-950 rounded-xl p-2">
              <img
                src={viewingPhotoUrl}
                alt="Student Photo Preview"
                className="max-h-[50vh] object-contain rounded-lg"
              />
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span>Expires in 60 seconds.</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setViewingPhotoUrl(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

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
            <strong className="text-slate-900 dark:text-[#f1f5f9]">&ldquo;{studentToDelete?.full_name}&rdquo;</strong>?
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
