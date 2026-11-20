import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Layers,
  Edit2,
  Trash2,
  ArrowRightLeft,
  Shield,
  Clock,
  ClipboardCheck,
  DollarSign,
  PlusCircle,
  MessageSquare,
  FileText,
  QrCode,
} from 'lucide-react';
import { getStudentById, updateStudent, deleteStudent, transferStudentBatch } from '../services/studentService';
import { getStudentAttendanceSummary } from '../services/attendanceService';
import { getStudentFeeSummary } from '../services/paymentService';
import type {
  Student,
  StudentFormData,
  AttendanceStatus,
  StudentFeeSummary,
  MonthlyFee,
  Payment,
} from '../types';
import { getAttendanceStatusBadge } from '../utils/attendanceUtils';
import { formatIndianCurrency, formatBillingMonth } from '../utils/feeUtils';
import { formatDisplayDate } from '../utils/formUtils';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { StudentFormModal } from '../components/StudentFormModal';
import { TransferBatchModal } from '../components/TransferBatchModal';
import { StudentAvatar } from '../components/StudentAvatar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { WhatsAppReminderModal } from '../components/WhatsAppReminderModal';
import { ModifyStudentFeeModal } from '../components/ModifyStudentFeeModal';
import { PaymentRequestModal } from '../components/PaymentRequestModal';

export const StudentProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Attendance stats for student
  const [attendanceStats, setAttendanceStats] = useState<{
    present: number;
    absent: number;
    total: number;
    percentage: number;
    recentHistory: Array<{ date: string; status: AttendanceStatus; batchName?: string }>;
  } | null>(null);

  // Fees & Payments summary
  const [feeSummary, setFeeSummary] = useState<StudentFeeSummary | null>(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fee modals
  const [selectedFeeForPayment, setSelectedFeeForPayment] = useState<MonthlyFee | null>(null);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<Payment | null>(null);
  const [receiptBalanceRemaining, setReceiptBalanceRemaining] = useState<number>(0);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [reminderFee, setReminderFee] = useState<MonthlyFee | null>(null);
  const [isPaymentRequestOpen, setIsPaymentRequestOpen] = useState(false);
  const [paymentRequestFee, setPaymentRequestFee] = useState<MonthlyFee | null>(null);
  const [isModifyFeeOpen, setIsModifyFeeOpen] = useState(false);

  const loadStudent = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const [studRes, attRes, feeRes] = await Promise.all([
      getStudentById(id),
      getStudentAttendanceSummary(id),
      getStudentFeeSummary(id),
    ]);

    if (studRes.error) {
      setError(studRes.error);
    } else {
      setStudent(studRes.student);
    }

    if (!attRes.error) {
      setAttendanceStats({
        present: attRes.present,
        absent: attRes.absent,
        total: attRes.total,
        percentage: attRes.percentage,
        recentHistory: attRes.recentHistory,
      });
    }

    if (!feeRes.error && feeRes.summary) {
      setFeeSummary(feeRes.summary);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleEditSubmit = async (formData: StudentFormData): Promise<boolean> => {
    if (!id) return false;
    const res = await updateStudent(id, formData);
    if (res.error) {
      alert(`Failed to update student: ${res.error}`);
      return false;
    }
    await loadStudent();
    return true;
  };

  const handleTransferBatch = async (studentId: string, newBatchId: string | null): Promise<boolean> => {
    const res = await transferStudentBatch(studentId, newBatchId);
    if (res.error) {
      alert(`Failed to transfer batch: ${res.error}`);
      return false;
    }
    await loadStudent();
    return true;
  };

  const handleDeleteConfirm = async () => {
    if (!student) return;
    setIsDeleting(true);
    const res = await deleteStudent(student.id, student.photo_url);
    setIsDeleting(false);

    if (res.error) {
      alert(`Failed to delete student: ${res.error}`);
    } else {
      navigate('/students', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-12 text-center">
        <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-700 border-t-slate-800 dark:border-t-slate-200 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading student profile...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="space-y-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate('/students')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Students
        </Button>
        <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-8 text-center">
          <p className="text-red-600 dark:text-rose-400 font-semibold mb-2">Student Not Found</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error || 'This student record does not exist or was deleted.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button and quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate('/students')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Students List
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsTransferModalOpen(true)}
            icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
          >
            Transfer Batch
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            icon={<Edit2 className="w-3.5 h-3.5" />}
          >
            Edit Profile
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-red-600 dark:text-rose-400 hover:text-red-700 dark:hover:text-rose-300 hover:bg-red-50 dark:hover:bg-red-950/30"
            icon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <StudentAvatar
            photoUrl={student.photo_url}
            name={student.full_name}
            className="w-24 h-24"
            textClassName="text-2xl font-bold uppercase"
          />

          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {student.full_name}
              </h1>
              <Badge variant={student.status === 'active' ? 'success' : 'neutral'} dot>
                {student.status === 'active' ? 'Active Student' : 'Inactive'}
              </Badge>
            </div>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Enrolled on: {formatDisplayDate(student.enrollment_date)}</span>
            </p>
          </div>

          <div className="sm:text-right p-3 rounded-lg bg-slate-50 dark:bg-[#1E293B] border border-slate-200 dark:border-[#26324a] w-full sm:w-auto">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Monthly Tuition Fee</span>
            <div className="flex items-center sm:justify-end gap-2 mt-0.5">
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {formatIndianCurrency(student.monthly_fee)}
              </span>
              <button
                type="button"
                onClick={() => setIsModifyFeeOpen(true)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium underline"
              >
                Change Fee
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Batch Allocation */}
        <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              Batch Allocation
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTransferModalOpen(true)}
            >
              Change Batch
            </Button>
          </div>

          {student.batch ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1E293B] border border-slate-200 dark:border-[#26324a]">
                <Link
                  to={`/batches/${student.batch.id}`}
                  className="font-bold text-slate-900 dark:text-slate-100 text-base hover:text-indigo-600 dark:hover:text-indigo-400 block transition-colors"
                >
                  {student.batch.name}
                </Link>
                <div className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <p className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Days:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {(student.batch.days_of_week || []).join(', ')}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Schedule:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {student.batch.start_time?.substring(0, 5)} - {student.batch.end_time?.substring(0, 5)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
              <p className="font-semibold">No Batch Assigned</p>
              <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                This student has not been assigned to any class schedule yet. Click &ldquo;Change Batch&rdquo; to assign them to an active batch.
              </p>
            </div>
          )}
        </div>

        {/* Contact Information */}
        <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-6 shadow-xs">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Phone className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              Contact Information
            </h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                Student Phone:
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{student.phone || '—'}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                Email Address:
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{student.email || '—'}</span>
            </div>

            <div className="py-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                Residential Address:
              </span>
              <p className="text-slate-800 dark:text-slate-200 font-medium bg-slate-50 dark:bg-[#1E293B] p-2.5 rounded-lg border border-slate-200 dark:border-[#26324a] text-xs sm:text-sm">
                {student.address || 'No residential address recorded.'}
              </p>
            </div>
          </div>
        </div>

        {/* Guardian / Emergency Contact */}
        <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-6 shadow-xs">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              Guardian / Emergency Contact
            </h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Guardian Name:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {student.guardian_name || 'Not provided'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Guardian Phone:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {student.guardian_phone || 'Not provided'}
              </span>
            </div>
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-6 shadow-xs">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800 mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              Attendance Summary
            </h2>
            {attendanceStats && (
              <Badge
                variant={getAttendanceStatusBadge(attendanceStats.percentage, attendanceStats.total).variant}
              >
                {attendanceStats.percentage}% Rate
              </Badge>
            )}
          </div>

          {attendanceStats && attendanceStats.total > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60">
                  <span className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300 block">Present</span>
                  <span className="text-lg font-bold text-emerald-800 dark:text-emerald-200">{attendanceStats.present}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-rose-950/40 border border-red-100 dark:border-rose-900/60">
                  <span className="text-xs font-semibold uppercase text-red-700 dark:text-rose-300 block">Absent</span>
                  <span className="text-lg font-bold text-red-800 dark:text-rose-200">{attendanceStats.absent}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#1E293B] border border-slate-200 dark:border-[#26324a]">
                  <span className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 block">Total</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{attendanceStats.total}</span>
                </div>
              </div>

              {attendanceStats.recentHistory.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Recent Classes
                  </p>
                  <div className="space-y-1.5">
                    {attendanceStats.recentHistory.map((h, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-md bg-slate-50 dark:bg-[#1E293B]"
                      >
                        <span className="font-medium text-slate-700 dark:text-slate-300">{h.date}</span>
                        <Badge variant={h.status === 'present' ? 'success' : 'danger'} size="sm">
                          {h.status === 'present' ? 'Present' : 'Absent'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-slate-400 italic">
              No attendance records recorded for this student yet.
            </div>
          )}
        </div>

        {/* Fees & Dues Overview */}
        <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-6 shadow-xs md:col-span-2">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Fees &amp; Payment History
            </h2>
            {feeSummary && feeSummary.totalBalance > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const unpaidFee = feeSummary.fees.find((f) => (f.balance || 0) > 0);
                    if (unpaidFee) {
                      setPaymentRequestFee(unpaidFee);
                      setIsPaymentRequestOpen(true);
                    }
                  }}
                  icon={<QrCode className="w-3.5 h-3.5" />}
                >
                  Send payment request
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    // Pick the earliest unpaid fee for reminder
                    const unpaidFee = feeSummary.fees.find((f) => (f.balance || 0) > 0);
                    setReminderFee(unpaidFee || null);
                    setIsReminderOpen(true);
                  }}
                  icon={<MessageSquare className="w-3.5 h-3.5" />}
                  className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800"
                >
                  Send WhatsApp Reminder
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    const unpaidFee = feeSummary.fees.find((f) => (f.balance || 0) > 0);
                    if (unpaidFee) setSelectedFeeForPayment(unpaidFee);
                  }}
                  icon={<PlusCircle className="w-3.5 h-3.5" />}
                >
                  Record Payment
                </Button>
              </div>
            )}
          </div>

          {/* Balance Cards */}
          {feeSummary ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1E293B] border border-slate-200 dark:border-[#26324a]">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase block">Total Invoiced</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                    {formatIndianCurrency(feeSummary.totalDue)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60">
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 uppercase block">Total Paid</span>
                  <span className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mt-0.5 block">
                    {formatIndianCurrency(feeSummary.totalPaid)}
                  </span>
                </div>
                <div
                  className={`p-3 rounded-xl border ${
                    feeSummary.totalBalance > 0
                      ? 'bg-red-50 dark:bg-rose-950/40 border-red-200 dark:border-rose-900/60 text-red-900 dark:text-rose-200'
                      : 'bg-slate-50 dark:bg-[#1E293B] border-slate-200 dark:border-[#26324a] text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-xs font-medium uppercase block">Outstanding Balance</span>
                  <span
                    className={`text-lg font-bold mt-0.5 block ${
                      feeSummary.totalBalance > 0 ? 'text-red-700 dark:text-rose-300' : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {formatIndianCurrency(feeSummary.totalBalance)}
                  </span>
                </div>
              </div>

              {/* Monthly Fees List */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Monthly Fee Records
                </h3>
                {feeSummary.fees.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No monthly fee records generated yet.
                  </p>
                ) : (
                  <div className="border border-slate-200 dark:border-[#26324a] rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {feeSummary.fees.map((fee) => (
                      <div
                        key={fee.id}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatBillingMonth(fee.billing_month)}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            Due date: {formatDisplayDate(fee.due_date)} • Amount: {formatIndianCurrency(fee.amount_due)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="block font-medium text-slate-700 dark:text-slate-300">
                              Paid: {formatIndianCurrency(fee.amount_paid || 0)}
                            </span>
                            {(fee.balance || 0) > 0 && (
                              <span className="block text-red-600 dark:text-rose-400 font-semibold">
                                Due: {formatIndianCurrency(fee.balance || 0)}
                              </span>
                            )}
                          </div>
                          {(fee.balance || 0) > 0 && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPaymentRequestFee(fee);
                                  setIsPaymentRequestOpen(true);
                                }}
                                icon={<QrCode className="w-3 h-3" />}
                              >
                                Send payment request
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => setSelectedFeeForPayment(fee)}
                                icon={<PlusCircle className="w-3 h-3" />}
                              >
                                Pay
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payments History */}
              {feeSummary.payments.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Payment Receipts History
                  </h3>
                  <div className="border border-slate-200 dark:border-[#26324a] rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {feeSummary.payments.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                      >
                        <div>
                          <p className="font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                            {p.receipt_number}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            {formatDisplayDate(p.payment_date)} • Mode: {p.method.toUpperCase()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {formatIndianCurrency(p.amount)}
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedPaymentForReceipt(p)}
                            icon={<FileText className="w-3.5 h-3.5" />}
                          >
                            Receipt
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-slate-400 italic">
              Loading fee information...
            </div>
          )}
        </div>

        {/* Record Metadata */}
        <div className="bg-white dark:bg-[#131c2e] rounded-xl border border-slate-200 dark:border-[#26324a] p-6 shadow-xs">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              Record History
            </h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Created at:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {new Date(student.created_at).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Last updated:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {new Date(student.updated_at).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <StudentFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        student={student}
      />

      {/* Transfer Batch Modal */}
      <TransferBatchModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        student={student}
        onTransfer={handleTransferBatch}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Student Record"
        message={
          <>
            Are you sure you want to permanently delete student{' '}
            <strong className="text-slate-900">&ldquo;{student.full_name}&rdquo;</strong>?
            This action cannot be undone.
          </>
        }
        confirmText="Yes, Delete Student"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={!!selectedFeeForPayment}
        onClose={() => setSelectedFeeForPayment(null)}
        fee={selectedFeeForPayment}
        onSuccess={(payment) => {
          loadStudent();
          setReceiptBalanceRemaining(
            Math.max(
              0,
              (selectedFeeForPayment?.balance || 0) - payment.amount
            )
          );
          setSelectedPaymentForReceipt(payment);
        }}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={!!selectedPaymentForReceipt}
        onClose={() => setSelectedPaymentForReceipt(null)}
        payment={selectedPaymentForReceipt}
        balanceRemaining={receiptBalanceRemaining}
      />

      {/* WhatsApp Reminder Modal */}
      <WhatsAppReminderModal
        isOpen={isReminderOpen}
        onClose={() => {
          setIsReminderOpen(false);
          setReminderFee(null);
        }}
        fee={reminderFee}
        student={student}
      />

      {/* Modify Monthly Fee Modal */}
      <ModifyStudentFeeModal
        isOpen={isModifyFeeOpen}
        onClose={() => setIsModifyFeeOpen(false)}
        student={student}
        onSuccess={() => loadStudent()}
      />

      {/* Payment Request Modal */}
      <PaymentRequestModal
        isOpen={isPaymentRequestOpen}
        onClose={() => {
          setIsPaymentRequestOpen(false);
          setPaymentRequestFee(null);
        }}
        fee={paymentRequestFee}
      />
    </div>
  );
};
