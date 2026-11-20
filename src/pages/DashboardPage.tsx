import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Layers,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ClipboardCheck,
  AlertTriangle,
  Phone,
  DollarSign,
  PlusCircle,
  CreditCard,
  Database,
  Download,
  X,
} from 'lucide-react';
import { getAcademySettings } from '../services/academyService';
import {
  getStudentCounts,
  getRecentStudents,
  getStudentsWithoutBatch,
  transferStudentBatch,
} from '../services/studentService';
import { getTodayClasses } from '../services/classService';
import {
  getTodayAttendanceSummary,
  getNeedsAttentionStudents,
} from '../services/attendanceService';
import { getMonthlyFees, getMonthlyFinancialSummary } from '../services/feeService';
import type {
  AcademySettings,
  Student,
  ClassSession,
  ConsecutiveAbsenceStudent,
  MonthlyFee,
  MonthlyFinancialSummary,
  Payment,
} from '../types';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { TransferBatchModal } from '../components/TransferBatchModal';
import { MarkAttendanceModal } from '../components/MarkAttendanceModal';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { StudentAvatar } from '../components/StudentAvatar';
import { formatTimeAmPm } from '../utils/attendanceUtils';
import {
  formatIndianCurrency,
  getBillingMonthDateString,
  formatBillingMonth,
} from '../utils/feeUtils';
import { formatDisplayDate } from '../utils/formUtils';
import { isBackupOlderThanDays, getLastBackupDate } from '../utils/backupUtils';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { OnboardingWizardModal } from '../components/OnboardingWizardModal';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [settings, setSettings] = useState<AcademySettings | null>(null);
  const [studentCounts, setStudentCounts] = useState({ total: 0, active: 0, inactive: 0 });
  const [recentStudents, setRecentStudents] = useState<Student[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([]);
  const [isOnboardingWizardOpen, setIsOnboardingWizardOpen] = useState(false);

  // Today's Classes, Attendance Summary, Needs Attention
  const [todayClasses, setTodayClasses] = useState<ClassSession[]>([]);
  const [todayAttendance, setTodayAttendance] = useState({
    presentCount: 0,
    absentCount: 0,
    totalClasses: 0,
    markedClasses: 0,
  });
  const [needsAttentionList, setNeedsAttentionList] = useState<ConsecutiveAbsenceStudent[]>([]);

  // Financial Summary & Top 5 Pending Students
  const [financialSummary, setFinancialSummary] = useState<MonthlyFinancialSummary | null>(null);
  const [pendingFeeStudents, setPendingFeeStudents] = useState<MonthlyFee[]>([]);

  // Backup reminder status (older than 14 days)
  const [isBackupDue, setIsBackupDue] = useState(false);
  const [lastBackupText, setLastBackupText] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isBackupBannerDismissed, setIsBackupBannerDismissed] = useState(() =>
    Boolean(sessionStorage.getItem('backup_banner_dismissed'))
  );

  // Modals state
  const [selectedStudentForBatch, setSelectedStudentForBatch] = useState<Student | null>(null);
  const [attendanceModalClass, setAttendanceModalClass] = useState<ClassSession | null>(null);
  const [selectedFeeForPayment, setSelectedFeeForPayment] = useState<MonthlyFee | null>(null);

  // Receipt Modal State after successful payment
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<Payment | null>(null);
  const [receiptBalanceRemaining, setReceiptBalanceRemaining] = useState<number>(0);

  const currentMonthStr = getBillingMonthDateString(new Date());
  const currentMonthYear = formatBillingMonth(currentMonthStr);

  const loadDashboardData = async () => {
    setLoading(true);
    setDbError(null);

    try {
      const [
        settingsRes,
        countsRes,
        recentRes,
        unassignedRes,
        todayClassesRes,
        todayAttRes,
        attentionRes,
        summaryRes,
        feesRes,
      ] = await Promise.all([
        getAcademySettings(),
        getStudentCounts(),
        getRecentStudents(5),
        getStudentsWithoutBatch(),
        getTodayClasses(),
        getTodayAttendanceSummary(),
        getNeedsAttentionStudents(),
        getMonthlyFinancialSummary(currentMonthStr),
        getMonthlyFees(currentMonthStr),
      ]);

      if (settingsRes.error) {
        setDbError(settingsRes.error);
      } else if (settingsRes.settings) {
        setSettings(settingsRes.settings);
      }

      if (countsRes.error) {
        setDbError((prev) => prev || countsRes.error);
      } else {
        setStudentCounts({
          total: countsRes.total,
          active: countsRes.active,
          inactive: countsRes.inactive,
        });
      }

      if (recentRes.students) setRecentStudents(recentRes.students);
      if (unassignedRes.students) setUnassignedStudents(unassignedRes.students);
      if (todayClassesRes.classes) setTodayClasses(todayClassesRes.classes);
      if (!todayAttRes.error) {
        setTodayAttendance({
          presentCount: todayAttRes.presentCount,
          absentCount: todayAttRes.absentCount,
          totalClasses: todayAttRes.totalClasses,
          markedClasses: todayAttRes.markedClasses,
        });
      }
      if (attentionRes.students) setNeedsAttentionList(attentionRes.students);

      if (summaryRes.summary) {
        setFinancialSummary(summaryRes.summary);
      }

      if (feesRes.fees) {
        const pending = feesRes.fees
          .filter((fee) => (fee.balance ?? fee.amount_due) > 0)
          .sort((a, b) => (b.balance ?? b.amount_due) - (a.balance ?? a.amount_due))
          .slice(0, 5);
        setPendingFeeStudents(pending);
      }
    } catch (err: unknown) {
      console.error('Error loading dashboard data:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to connect to one or more database tables.';
      setDbError(message);
    } finally {
      const backupOlder = isBackupOlderThanDays(14);
      setIsBackupDue(backupOlder);
      const lastDate = getLastBackupDate();
      setLastBackupText(lastDate ? formatDisplayDate(lastDate) : null);

      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleTransferBatch = async (studentId: string, newBatchId: string | null): Promise<boolean> => {
    const res = await transferStudentBatch(studentId, newBatchId);
    if (res.error) return false;
    await loadDashboardData();
    return true;
  };

  const handlePaymentSuccess = (payment: Payment) => {
    setSelectedPaymentForReceipt(payment);
    setReceiptBalanceRemaining(0);
    loadDashboardData();
  };

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Onboarding Checklist for new academies */}
      <OnboardingChecklist
        hasProfileConfigured={Boolean(
          settings?.is_onboarding_completed ||
            (settings?.contact_number && settings?.address)
        )}
        hasBatches={Boolean(studentCounts.total > 0 || todayClasses.length > 0)}
        hasStudents={studentCounts.total > 0}
        onOpenWizard={() => setIsOnboardingWizardOpen(true)}
      />

      {/* Welcome & Overview Header */}
      <div className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#f1f5f9]">
              {settings?.academy_name || 'MIX with Me Classes'}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-[#a9b4c7]">
              Welcome back. Here is your classes, attendance, fee collection, and academy overview.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate('/timetable')}
              icon={<Calendar className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Timetable
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate('/attendance')}
              icon={<ClipboardCheck className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Attendance
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => navigate('/fees')}
              icon={<CreditCard className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Fees &amp; Payments
            </Button>
          </div>
        </div>

        {/* Database warning notice if tables are missing */}
        {dbError && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-100">Database Notice</p>
              <p className="mt-0.5">{dbError}</p>
            </div>
          </div>
        )}
      </div>

      {/* DISMISSIBLE INFORMATIVE BACKUP BANNER */}
      {isBackupDue && !isBackupBannerDismissed && (
        <div className="bg-indigo-50/70 dark:bg-[#1a2540] border border-indigo-200/80 dark:border-[#26324a] rounded-2xl p-4 sm:p-5 text-xs text-slate-700 dark:text-[#a9b4c7] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-900 dark:text-[#f1f5f9]">
                Data Safeguard Reminder
              </p>
              <p className="mt-0.5 text-slate-600 dark:text-[#a9b4c7]">
                {lastBackupText
                  ? `Your last downloaded backup was on ${lastBackupText}.`
                  : 'You have not downloaded a data backup recently.'}{' '}
                Downloading regular backups keeps your student records, schedule, and payment history safe.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate('/backups')}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Download Backup
            </Button>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('backup_banner_dismissed', 'true');
                setIsBackupBannerDismissed(true);
              }}
              aria-label="Dismiss backup reminder"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#131c2e] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          1. TODAY'S CLASSES & ATTENDANCE (Highest Daily Urgency)
         ======================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-[#a9b4c7]">
            Today&rsquo;s Classes &amp; Attendance
          </h2>
          <span className="text-xs text-slate-500 dark:text-[#a9b4c7] font-medium">{todayFormatted}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Today's Classes List (Takes 2 cols on desktop) */}
          <div className="lg:col-span-2 bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26324a] mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f5f9]">Today&rsquo;s Schedule</h3>
                    <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">
                      {todayClasses.length} {todayClasses.length === 1 ? 'class session' : 'class sessions'} today
                    </p>
                  </div>
                </div>

                <Link
                  to="/timetable"
                  className="text-xs font-semibold text-slate-700 dark:text-[#a9b4c7] hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
                >
                  <span>Full Timetable</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {loading ? (
                <div className="py-8 text-center text-slate-500 dark:text-[#a9b4c7] text-sm">
                  <div className="w-5 h-5 border-2 border-slate-200 dark:border-[#26324a] border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                  Loading today&rsquo;s schedule...
                </div>
              ) : todayClasses.length === 0 ? (
                <div className="py-8 text-center text-slate-500 dark:text-[#a9b4c7] text-sm">
                  <p className="font-medium text-slate-700 dark:text-[#f1f5f9]">No classes scheduled today</p>
                  <p className="text-xs text-slate-400 dark:text-[#a9b4c7] mt-1">
                    Enjoy your day off or review upcoming schedules in the Timetable.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#26324a]">
                  {todayClasses.map((c) => {
                    const isCancelled = c.status === 'cancelled';
                    const summary = c.attendance_summary;

                    return (
                      <div
                        key={c.id}
                        className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-[#1a2540] transition-colors rounded-lg px-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p
                              className={`font-semibold text-sm ${
                                isCancelled ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-[#f1f5f9]'
                              }`}
                            >
                              {c.batch?.name || 'Class Session'}
                            </p>
                            {isCancelled ? (
                              <Badge variant="danger" size="sm">
                                Cancelled
                              </Badge>
                            ) : summary?.marked ? (
                              <Badge variant="success" size="sm">
                                {summary.present}P / {summary.absent}A
                              </Badge>
                            ) : (
                              <Badge variant="neutral" size="sm">
                                Unmarked
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 dark:text-[#a9b4c7] mt-0.5">
                            {formatTimeAmPm(c.start_time)} &ndash; {formatTimeAmPm(c.end_time)}
                          </p>
                        </div>

                        {!isCancelled && (
                          <Button
                            type="button"
                            variant={summary?.marked ? 'ghost' : 'outline'}
                            size="sm"
                            onClick={() => setAttendanceModalClass(c)}
                          >
                            {summary?.marked ? 'Edit' : 'Mark'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Today's Attendance Overview Card (Takes 1 col on desktop) */}
          <div className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26324a] mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f5f9]">Attendance Pulse</h3>
                    <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">Summary for today</p>
                  </div>
                </div>

                <Link
                  to="/attendance"
                  className="text-xs font-semibold text-slate-700 dark:text-[#a9b4c7] hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
                >
                  <span>Attendance</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                  <span className="text-xs font-semibold uppercase tracking-wider block text-emerald-700 dark:text-emerald-400">Present</span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-[#f1f5f9] mt-1 block">{todayAttendance.presentCount}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
                  <span className="text-xs font-semibold uppercase tracking-wider block text-rose-700 dark:text-rose-400">Absent</span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-[#f1f5f9] mt-1 block">{todayAttendance.absentCount}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-600 dark:text-[#a9b4c7]">Sessions Marked</span>
                  <span className="font-bold text-slate-900 dark:text-[#f1f5f9]">
                    {todayAttendance.markedClasses} of {todayAttendance.totalClasses}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-[#26324a] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        todayAttendance.totalClasses > 0
                          ? Math.round((todayAttendance.markedClasses / todayAttendance.totalClasses) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#26324a]">
              <Link
                to="/attendance"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-between"
              >
                <span>Open full attendance register</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. FEES DUE THIS MONTH (Second Daily Urgency)
         ======================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-[#a9b4c7]">
            Fees Due This Month ({currentMonthYear})
          </h2>
          <Link
            to="/fees"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <span>Fees &amp; Receipts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Financial Summary 2-Card Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => navigate('/fees')}
            className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-[#a9b4c7] uppercase tracking-wide truncate">
                  Fees Collected This Month
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#f1f5f9]">
                  {formatIndianCurrency(financialSummary?.total_collected || 0)}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60">
                  {currentMonthYear}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#26324a]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-[#a9b4c7] font-medium">Payments received</span>
                <span className="text-slate-400 dark:text-[#a9b4c7] shrink-0">
                  {financialSummary?.paid_students_count || 0} students settled
                </span>
              </div>
            </div>
          </div>

          <div
            onClick={() => navigate('/fees')}
            className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-[#a9b4c7] uppercase tracking-wide truncate">
                  Fees Outstanding / Pending
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#f1f5f9]">
                  {formatIndianCurrency(financialSummary?.total_pending || 0)}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60">
                  {currentMonthYear}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#26324a]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-[#a9b4c7] font-medium">Pending collection</span>
                <span className="text-slate-400 dark:text-[#a9b4c7] shrink-0">
                  {financialSummary?.pending_students_count || 0} pending/partial
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top 5 Students with Pending Fees Card */}
        <div className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26324a] mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f5f9]">
                  Highest Pending Dues ({currentMonthYear})
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">
                  Top students with outstanding balance &bull; Record payment instantly
                </p>
              </div>
            </div>

            <Link
              to="/fees"
              className="text-xs font-semibold text-slate-700 dark:text-[#a9b4c7] hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
            >
              <span>View all fees</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500 dark:text-[#a9b4c7] text-sm">
              <div className="w-5 h-5 border-2 border-slate-200 dark:border-[#26324a] border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
              Checking fee records...
            </div>
          ) : pendingFeeStudents.length === 0 ? (
            <div className="py-8 text-center text-slate-600 dark:text-[#a9b4c7] text-sm flex flex-col items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mb-2" />
              <p className="font-semibold text-slate-800 dark:text-[#f1f5f9]">No pending dues for {currentMonthYear}!</p>
              <p className="text-xs text-slate-500 dark:text-[#a9b4c7] mt-0.5">
                All generated student fees for this month are settled or none are due.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#26324a]">
              {pendingFeeStudents.map((fee) => (
                <div
                  key={fee.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-[#1a2540] transition-colors rounded-lg px-2"
                >
                  <div className="flex items-center gap-3">
                    <StudentAvatar
                      photoUrl={fee.student?.photo_url}
                      name={fee.student?.full_name}
                      className="w-9 h-9"
                    />
                    <div>
                      <Link
                        to={`/students/${fee.student_id}`}
                        className="font-semibold text-slate-900 dark:text-[#f1f5f9] text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block"
                      >
                        {fee.student?.full_name}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">
                        {fee.student?.batch?.name || 'No Batch'} &bull; Due: {formatDisplayDate(fee.due_date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="font-bold text-rose-600 dark:text-rose-400 text-sm block">
                        {formatIndianCurrency(fee.balance || 0)}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-[#a9b4c7]">
                        of {formatIndianCurrency(fee.amount_due)}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedFeeForPayment(fee)}
                      icon={<PlusCircle className="w-3.5 h-3.5" />}
                    >
                      Pay
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          3. STUDENTS NEEDING ATTENTION & UNASSIGNED STUDENTS
         ======================================================== */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-[#a9b4c7]">
          Students Needing Action
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Needs Attention: Consecutive Absences List */}
          <div className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26324a] mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f5f9]">Consecutive Absences</h3>
                    <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">Students absent 3+ times in a row</p>
                  </div>
                </div>

                {needsAttentionList.length > 0 && (
                  <Badge variant="danger" size="sm">
                    {needsAttentionList.length} flagged
                  </Badge>
                )}
              </div>

              {loading ? (
                <div className="py-8 text-center text-slate-500 dark:text-[#a9b4c7] text-sm">
                  <div className="w-5 h-5 border-2 border-slate-200 dark:border-[#26324a] border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                  Checking absence streaks...
                </div>
              ) : needsAttentionList.length === 0 ? (
                <div className="py-8 text-center text-slate-600 dark:text-[#a9b4c7] text-sm flex flex-col items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mb-2" />
                  <p className="font-semibold text-slate-800 dark:text-[#f1f5f9]">Attendance healthy!</p>
                  <p className="text-xs text-slate-500 dark:text-[#a9b4c7] mt-0.5">
                    No students currently have 3 or more consecutive absences.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#26324a]">
                  {needsAttentionList.map((item) => (
                    <div
                      key={item.student_id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-[#1a2540] transition-colors rounded-lg px-2"
                    >
                      <div className="flex items-center gap-3">
                        <StudentAvatar
                          photoUrl={item.photo_url}
                          name={item.student_name}
                          className="w-9 h-9"
                        />
                        <div>
                          <Link
                            to={`/students/${item.student_id}`}
                            className="font-semibold text-slate-900 dark:text-[#f1f5f9] text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block"
                          >
                            {item.student_name}
                          </Link>
                          <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">
                            {item.batch_name} &bull; Last absent: {item.last_absence_date}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="danger" size="sm">
                          {item.consecutive_absences} in a row
                        </Badge>
                        {item.phone && (
                          <a
                            href={`tel:${item.phone}`}
                            title={`Call ${item.phone}`}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-[#26324a] hover:bg-slate-100 dark:hover:bg-[#1a2540] text-slate-600 dark:text-[#a9b4c7] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Students Without a Batch */}
          <div className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26324a] mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-700 dark:text-amber-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f5f9]">Unassigned Students</h3>
                    <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">Active students awaiting batch assignment</p>
                  </div>
                </div>

                {unassignedStudents.length > 0 && (
                  <Badge variant="warning" size="sm">
                    {unassignedStudents.length} unassigned
                  </Badge>
                )}
              </div>

              {loading ? (
                <div className="py-8 text-center text-slate-500 dark:text-[#a9b4c7] text-sm">
                  <div className="w-5 h-5 border-2 border-slate-200 dark:border-[#26324a] border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                  Checking batch rosters...
                </div>
              ) : unassignedStudents.length === 0 ? (
                <div className="py-8 text-center text-slate-600 dark:text-[#a9b4c7] text-sm flex flex-col items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mb-2" />
                  <p className="font-semibold text-slate-800 dark:text-[#f1f5f9]">All students assigned</p>
                  <p className="text-xs text-slate-500 dark:text-[#a9b4c7] mt-0.5">
                    Every active student is currently enrolled in a batch schedule.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#26324a]">
                  {unassignedStudents.map((s) => (
                    <div
                      key={s.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-[#1a2540] transition-colors rounded-lg px-2"
                    >
                      <div className="flex items-center gap-3">
                        <StudentAvatar
                          photoUrl={s.photo_url}
                          name={s.full_name}
                          className="w-9 h-9"
                        />
                        <div>
                          <Link
                            to={`/students/${s.id}`}
                            className="font-semibold text-slate-900 dark:text-[#f1f5f9] text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block"
                          >
                            {s.full_name}
                          </Link>
                          <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">{s.phone || 'No phone'}</p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedStudentForBatch(s)}
                        icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                      >
                        Assign Batch
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          4. ACADEMY OVERVIEW & RECENT STUDENTS
         ======================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-[#a9b4c7]">
            Academy Overview
          </h2>
          <Link
            to="/students"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <span>Students &amp; Batches</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 3 Student Overview Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => navigate('/students')}
            className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-[#a9b4c7] uppercase tracking-wide truncate">
                  Total Students
                </span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#1a2540] flex items-center justify-center text-slate-700 dark:text-[#a9b4c7] shrink-0">
                  <Users className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#f1f5f9]">
                  {studentCounts.total}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-slate-100 dark:bg-[#1a2540] text-slate-700 dark:text-[#a9b4c7] border-slate-200 dark:border-[#26324a]">
                  All time
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#26324a]">
              <span className="text-xs text-slate-500 dark:text-[#a9b4c7]">Total registrations</span>
            </div>
          </div>

          <div
            onClick={() => navigate('/students')}
            className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-[#a9b4c7] uppercase tracking-wide truncate">
                  Active Students
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#f1f5f9]">
                  {studentCounts.active}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60">
                  Active
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#26324a]">
              <span className="text-xs text-slate-500 dark:text-[#a9b4c7]">Currently attending</span>
            </div>
          </div>

          <div
            onClick={() => navigate('/students')}
            className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-[#a9b4c7] uppercase tracking-wide truncate">
                  Inactive / Paused
                </span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#1a2540] flex items-center justify-center text-slate-700 dark:text-[#a9b4c7] shrink-0">
                  <UserX className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#f1f5f9]">
                  {studentCounts.inactive}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-slate-100 dark:bg-[#1a2540] text-slate-700 dark:text-[#a9b4c7] border-slate-200 dark:border-[#26324a]">
                  Archived
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#26324a]">
              <span className="text-xs text-slate-500 dark:text-[#a9b4c7]">Paused or discontinued</span>
            </div>
          </div>
        </div>

        {/* Recently Added Students Card */}
        <div className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-[#26324a] p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26324a] mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f5f9]">Recently Enrolled Students</h3>
                <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">Last 5 registrations</p>
              </div>
            </div>

            <Link
              to="/students"
              className="text-xs font-semibold text-slate-700 dark:text-[#a9b4c7] hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
            >
              <span>View all students</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500 dark:text-[#a9b4c7] text-sm">
              <div className="w-5 h-5 border-2 border-slate-200 dark:border-[#26324a] border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
              Loading recent students...
            </div>
          ) : recentStudents.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-[#a9b4c7] text-sm">
              <p className="font-medium text-slate-700 dark:text-[#f1f5f9]">No students added yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#26324a]">
              {recentStudents.map((s) => (
                <div
                  key={s.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-[#1a2540] transition-colors rounded-lg px-2"
                >
                  <div className="flex items-center gap-3">
                    <StudentAvatar
                      photoUrl={s.photo_url}
                      name={s.full_name}
                      className="w-9 h-9"
                    />
                    <div>
                      <Link
                        to={`/students/${s.id}`}
                        className="font-semibold text-slate-900 dark:text-[#f1f5f9] text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block"
                      >
                        {s.full_name}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">
                        {s.batch ? s.batch.name : 'No Batch Assigned'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-slate-900 dark:text-[#f1f5f9] block">
                      {formatIndianCurrency(s.monthly_fee)}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-[#a9b4c7]">{s.enrollment_date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transfer/Assign Batch Modal */}
      <TransferBatchModal
        isOpen={Boolean(selectedStudentForBatch)}
        onClose={() => setSelectedStudentForBatch(null)}
        student={selectedStudentForBatch}
        onTransfer={handleTransferBatch}
      />

      {/* Mark/Edit Attendance Modal for Today's Classes */}
      <MarkAttendanceModal
        isOpen={Boolean(attendanceModalClass)}
        onClose={() => setAttendanceModalClass(null)}
        classSession={attendanceModalClass}
        onSuccess={loadDashboardData}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={Boolean(selectedFeeForPayment)}
        onClose={() => setSelectedFeeForPayment(null)}
        fee={selectedFeeForPayment}
        onSuccess={handlePaymentSuccess}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(selectedPaymentForReceipt)}
        onClose={() => setSelectedPaymentForReceipt(null)}
        payment={selectedPaymentForReceipt}
        balanceRemaining={receiptBalanceRemaining}
      />

      {/* Onboarding Wizard Modal */}
      <OnboardingWizardModal
        isOpen={isOnboardingWizardOpen}
        onClose={() => setIsOnboardingWizardOpen(false)}
        initialSettings={settings}
        onComplete={(updated) => {
          setSettings(updated);
          loadDashboardData();
        }}
      />
    </div>
  );
};
