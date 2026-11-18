import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Layers,
  ArrowRight,
  User,
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
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<Payment | null>(null);
  const [receiptBalanceRemaining, setReceiptBalanceRemaining] = useState<number>(0);

  const currentMonthStr = getBillingMonthDateString(new Date());

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
      } else {
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
        // Filter students with pending balance > 0 and take top 5 sorted by balance descending
        const pending = feesRes.fees
          .filter((f) => (f.balance || 0) > 0)
          .sort((a, b) => (b.balance || 0) - (a.balance || 0))
          .slice(0, 5);
        setPendingFeeStudents(pending);
      }

      // Check if backup is older than 14 days
      const isDue = isBackupOlderThanDays(14);
      setIsBackupDue(isDue);
      const rawBackupDate = getLastBackupDate();
      if (rawBackupDate) {
        try {
          setLastBackupText(
            new Date(rawBackupDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          );
        } catch {
          setLastBackupText(rawBackupDate);
        }
      } else {
        setLastBackupText(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading dashboard metrics';
      setDbError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleTransferBatch = async (studentId: string, newBatchId: string | null): Promise<boolean> => {
    const res = await transferStudentBatch(studentId, newBatchId);
    if (res.error) {
      alert(`Failed to assign batch: ${res.error}`);
      return false;
    }
    await loadDashboardData();
    return true;
  };

  const handlePaymentSuccess = (payment: Payment) => {
    loadDashboardData();
    const remaining = Math.max(
      0,
      (selectedFeeForPayment?.balance || 0) - payment.amount
    );
    setReceiptBalanceRemaining(remaining);
    setSelectedPaymentForReceipt(payment);
  };

  const currentMonthYear = formatBillingMonth(currentMonthStr);

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  const stats = [
    {
      title: 'Total Students',
      value: studentCounts.total.toString(),
      emptyLabel: studentCounts.total === 0 ? 'No students enrolled' : `${studentCounts.total} registered`,
      description: 'Overall student registrations',
      icon: Users,
      badge: 'All time',
      isReal: true,
      onClick: () => navigate('/students'),
    },
    {
      title: 'Active Students',
      value: studentCounts.active.toString(),
      emptyLabel: studentCounts.active === 0 ? 'No active students' : `${studentCounts.active} active`,
      description: 'Currently attending classes',
      icon: UserCheck,
      badge: 'Active status',
      isReal: true,
      onClick: () => navigate('/students'),
    },
    {
      title: 'Inactive Students',
      value: studentCounts.inactive.toString(),
      emptyLabel: studentCounts.inactive === 0 ? 'No inactive students' : `${studentCounts.inactive} inactive`,
      description: 'Paused or discontinued students',
      icon: UserX,
      badge: 'Archived',
      isReal: true,
      onClick: () => navigate('/students'),
    },
    {
      title: 'Fees Collected This Month',
      value: formatIndianCurrency(financialSummary?.total_collected || 0),
      emptyLabel: `${financialSummary?.paid_students_count || 0} students settled`,
      description: `Payments received for ${currentMonthYear}`,
      icon: DollarSign,
      badge: currentMonthYear,
      isReal: true,
      onClick: () => navigate('/fees'),
    },
    {
      title: 'Fees Pending This Month',
      value: formatIndianCurrency(financialSummary?.total_pending || 0),
      emptyLabel: `${financialSummary?.pending_students_count || 0} pending/partial`,
      description: `Outstanding fees for ${currentMonthYear}`,
      icon: Clock,
      badge: currentMonthYear,
      isReal: true,
      onClick: () => navigate('/fees'),
    },
  ];

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
      <div className="bg-white dark:bg-[#111a2b] rounded-2xl border border-slate-200 dark:border-[#1f2a3d] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {settings?.academy_name || 'MIX with Me Classes'}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Welcome back. Here is your classes, attendance, fee collection, and system backup overview.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate('/timetable')}
              icon={<Calendar className="w-4 h-4" />}
            >
              Timetable
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate('/attendance')}
              icon={<ClipboardCheck className="w-4 h-4" />}
            >
              Attendance
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => navigate('/fees')}
              icon={<CreditCard className="w-4 h-4" />}
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
        <div className="bg-blue-50/70 dark:bg-slate-900/80 border border-blue-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 text-xs text-slate-700 dark:text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-900 dark:text-white">
                Data Safeguard Reminder
              </p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-400">
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
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TODAY'S ATTENDANCE SUMMARY BANNER */}
      <div className="bg-white dark:bg-[#111a2b] rounded-2xl border border-slate-200 dark:border-[#1f2a3d] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Today&rsquo;s Attendance Summary</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {todayFormatted} • {todayAttendance.totalClasses}{' '}
              {todayAttendance.totalClasses === 1 ? 'class session' : 'class sessions'} today
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider block text-emerald-700 dark:text-emerald-400">Present</span>
              <span className="text-lg font-bold">{todayAttendance.presentCount}</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider block text-red-700 dark:text-red-400">Absent</span>
              <span className="text-lg font-bold">{todayAttendance.absentCount}</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider block text-slate-500 dark:text-slate-400">Marked</span>
              <span className="text-lg font-bold">
                {todayAttendance.markedClasses}/{todayAttendance.totalClasses}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Metrics Cards: 3 + 2 Layout that fills full width evenly */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Academy Overview
          </h2>
        </div>

        {/* Row 1: Student Overview (3 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.slice(0, 3).map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.title}
                onClick={stat.onClick}
                className="bg-white dark:bg-[#111a2b] rounded-2xl border border-slate-200 dark:border-[#1f2a3d] p-5 shadow-xs flex flex-col justify-between cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
                      {stat.title}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {stat.value}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                      {stat.badge}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{stat.description}</span>
                    <span className="text-slate-400 dark:text-slate-500 italic shrink-0">{stat.emptyLabel}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Row 2: Financial Overview (2 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats.slice(3, 5).map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.title}
                onClick={stat.onClick}
                className="bg-white dark:bg-[#111a2b] rounded-2xl border border-slate-200 dark:border-[#1f2a3d] p-5 shadow-xs flex flex-col justify-between cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
                      {stat.title}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {stat.value}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                      {stat.badge}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{stat.description}</span>
                    <span className="text-slate-400 dark:text-slate-500 italic shrink-0">{stat.emptyLabel}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-Column: TOP 5 STUDENTS WITH PENDING FEES & TODAY'S CLASSES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Students with Pending Fees */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Pending Dues ({currentMonthYear})</h3>
                  <p className="text-xs text-slate-500">Students with highest pending fees this month</p>
                </div>
              </div>

              <Link
                to="/fees"
                className="text-xs font-semibold text-slate-900 hover:text-indigo-600 flex items-center gap-1 transition-colors"
              >
                <span>View all fees</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-2" />
                Checking fee records...
              </div>
            ) : pendingFeeStudents.length === 0 ? (
              <div className="py-8 text-center text-slate-600 text-sm flex flex-col items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
                <p className="font-semibold text-slate-800">No pending dues for {currentMonthYear}!</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  All generated student fees for this month are collected or not yet generated.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingFeeStudents.map((fee) => (
                  <div
                    key={fee.id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors rounded-lg px-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {fee.student?.photo_url ? (
                          <img
                            src={fee.student.photo_url}
                            alt={fee.student.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <Link
                          to={`/students/${fee.student_id}`}
                          className="font-semibold text-slate-900 text-sm hover:text-indigo-600 transition-colors block"
                        >
                          {fee.student?.full_name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {fee.student?.batch?.name || 'No Batch'} • Due: {formatDisplayDate(fee.due_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="font-bold text-red-600 text-sm block">
                          {formatIndianCurrency(fee.balance || 0)}
                        </span>
                        <span className="text-[11px] text-slate-400">
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

        {/* Today's Classes List */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Today&rsquo;s Classes</h3>
                  <p className="text-xs text-slate-500">Scheduled sessions for {todayFormatted}</p>
                </div>
              </div>

              <Link
                to="/timetable"
                className="text-xs font-semibold text-slate-900 hover:text-blue-600 flex items-center gap-1 transition-colors"
              >
                <span>Full Timetable</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-2" />
                Loading today&rsquo;s schedule...
              </div>
            ) : todayClasses.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                <p className="font-medium text-slate-700">No classes scheduled today</p>
                <p className="text-xs text-slate-400 mt-1">
                  Enjoy your day off or review upcoming schedules in the Timetable.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todayClasses.map((c) => {
                  const isCancelled = c.status === 'cancelled';
                  const summary = c.attendance_summary;

                  return (
                    <div
                      key={c.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors rounded-lg px-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p
                            className={`font-semibold text-sm ${
                              isCancelled ? 'line-through text-slate-500' : 'text-slate-900'
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

                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatTimeAmPm(c.start_time)} – {formatTimeAmPm(c.end_time)}
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
      </div>

      {/* Two-Column: NEEDS ATTENTION & STUDENTS WITHOUT A BATCH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Attention: Consecutive Absences List */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Needs Attention</h3>
                  <p className="text-xs text-slate-500">Students with 3+ consecutive absences</p>
                </div>
              </div>

              {needsAttentionList.length > 0 && (
                <Badge variant="danger" size="sm">
                  {needsAttentionList.length} flagged
                </Badge>
              )}
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-2" />
                Checking absence streaks...
              </div>
            ) : needsAttentionList.length === 0 ? (
              <div className="py-8 text-center text-slate-600 text-sm flex flex-col items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
                <p className="font-semibold text-slate-800">Attendance looking healthy!</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  No students currently have 3 or more consecutive absences.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {needsAttentionList.map((item) => (
                  <div
                    key={item.student_id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors rounded-lg px-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {item.photo_url ? (
                          <img
                            src={item.photo_url}
                            alt={item.student_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <Link
                          to={`/students/${item.student_id}`}
                          className="font-semibold text-slate-900 text-sm hover:text-blue-600 transition-colors block"
                        >
                          {item.student_name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {item.batch_name} • Last absent: {item.last_absence_date}
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
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
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

        {/* Recently Added Students */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Recently Added Students</h3>
                  <p className="text-xs text-slate-500">Last 5 student registrations</p>
                </div>
              </div>

              <Link
                to="/students"
                className="text-xs font-semibold text-slate-900 hover:text-blue-600 flex items-center gap-1 transition-colors"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-2" />
                Loading recent students...
              </div>
            ) : recentStudents.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                <p className="font-medium text-slate-700">No students added yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentStudents.map((s) => (
                  <div
                    key={s.id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors rounded-lg px-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {s.photo_url ? (
                          <img
                            src={s.photo_url}
                            alt={s.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <Link
                          to={`/students/${s.id}`}
                          className="font-semibold text-slate-900 text-sm hover:text-blue-600 transition-colors block"
                        >
                          {s.full_name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {s.batch ? s.batch.name : 'No Batch Assigned'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-slate-900 block">
                        {formatIndianCurrency(s.monthly_fee)}
                      </span>
                      <span className="text-[11px] text-slate-400">{s.enrollment_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Students Without a Batch */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Students Without a Batch</h3>
                  <p className="text-xs text-slate-500">Active students awaiting schedule assignment</p>
                </div>
              </div>

              {unassignedStudents.length > 0 && (
                <Badge variant="warning" size="sm">
                  {unassignedStudents.length} unassigned
                </Badge>
              )}
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-2" />
                Checking batch rosters...
              </div>
            ) : unassignedStudents.length === 0 ? (
              <div className="py-8 text-center text-slate-600 text-sm flex flex-col items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
                <p className="font-semibold text-slate-800">All students assigned</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every active student is currently enrolled in a batch schedule.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {unassignedStudents.map((s) => (
                  <div
                    key={s.id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors rounded-lg px-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {s.photo_url ? (
                          <img
                            src={s.photo_url}
                            alt={s.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <Link
                          to={`/students/${s.id}`}
                          className="font-semibold text-slate-900 text-sm hover:text-blue-600 transition-colors block"
                        >
                          {s.full_name}
                        </Link>
                        <p className="text-xs text-slate-500">{s.phone || 'No phone'}</p>
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
