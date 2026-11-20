import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Calendar,
  AlertTriangle,
  History,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Search,
  PlusCircle,
  MessageSquare,
  FileText,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  QrCode,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Badge } from '../components/Badge';
import { Tabs } from '../components/Tabs';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { WhatsAppReminderModal } from '../components/WhatsAppReminderModal';
import { PaymentRequestModal } from '../components/PaymentRequestModal';
import { useTheme } from '../hooks/useTheme';
import type {
  MonthlyFee,
  Payment,
  FeeStatus,
  PaymentMethod,
  Batch,
  MonthlyFinancialSummary,
  MonthlyIncomeDataPoint,
  PaymentScreenshot,
} from '../types';
import { supabase } from '../lib/supabase';
import {
  formatIndianCurrency,
  formatBillingMonth,
  getBillingMonthDateString,
} from '../utils/feeUtils';
import { formatDisplayDate } from '../utils/formUtils';
import {
  getMonthlyFees,
  generateMonthlyFees,
  getOverdueFees,
  getMonthlyFinancialSummary,
  get12MonthIncomeReport,
} from '../services/feeService';
import { getPaymentHistory } from '../services/paymentService';
import { getBatches } from '../services/batchService';

export const FeesPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<'monthly' | 'overdue' | 'history' | 'analytics'>('monthly');

  // Batches
  const [batches, setBatches] = useState<Batch[]>([]);

  // Selected billing month (Defaults to current month's 1st day: YYYY-MM-01)
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    getBillingMonthDateString(new Date())
  );

  // Monthly Fees state
  const [monthlyFees, setMonthlyFees] = useState<MonthlyFee[]>([]);
  const [loadingFees, setLoadingFees] = useState<boolean>(true);
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<FeeStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [financialSummary, setFinancialSummary] = useState<MonthlyFinancialSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  // Overdue state
  const [overdueFees, setOverdueFees] = useState<MonthlyFee[]>([]);
  const [loadingOverdue, setLoadingOverdue] = useState<boolean>(false);

  // History state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyMethodFilter, setHistoryMethodFilter] = useState<PaymentMethod | 'all'>('all');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');

  // Analytics state
  const [incomeReportData, setIncomeReportData] = useState<MonthlyIncomeDataPoint[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);

  // Modals state
  const [selectedFeeForPayment, setSelectedFeeForPayment] = useState<MonthlyFee | null>(null);
  const [paymentInitialMethod, setPaymentInitialMethod] = useState<PaymentMethod | undefined>(undefined);
  const [paymentInitialAmount, setPaymentInitialAmount] = useState<number | undefined>(undefined);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<Payment | null>(null);
  const [receiptBalanceRemaining, setReceiptBalanceRemaining] = useState<number>(0);
  const [reminderFee, setReminderFee] = useState<MonthlyFee | null>(null);
  const [paymentRequestFee, setPaymentRequestFee] = useState<MonthlyFee | null>(null);

  // Screenshots state (Feature A)
  const [pendingScreenshots, setPendingScreenshots] = useState<PaymentScreenshot[]>([]);
  const [selectedScreenshot, setSelectedScreenshot] = useState<PaymentScreenshot | null>(null);
  const [screenshotSignedUrl, setScreenshotSignedUrl] = useState<string | null>(null);
  const [loadingScreenshot, setLoadingScreenshot] = useState<boolean>(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  const fetchPendingScreenshots = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('payment_screenshots')
        .select(`
          id,
          owner_id,
          payment_link_id,
          storage_path,
          mime_type,
          size_bytes,
          status,
          reviewed_at,
          created_at,
          payment_link:payment_links (
            id,
            fee_id,
            monthly_fee:monthly_fees (
              id,
              billing_month,
              amount_due,
              student:students (
                id,
                full_name,
                phone
              )
            )
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        if (import.meta.env.DEV) {
          console.warn('Could not load payment screenshots:', error);
        }
        return;
      }

      if (data) {
        setPendingScreenshots(data as unknown as PaymentScreenshot[]);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('Could not load payment screenshots:', err);
      }
    }
  }, []);

  const handleOpenScreenshotModal = async (screenshot: PaymentScreenshot) => {
    setSelectedScreenshot(screenshot);
    setScreenshotSignedUrl(null);
    setScreenshotError(null);
    setLoadingScreenshot(true);
    try {
      const { data, error } = await supabase.storage
        .from('payment-screenshots')
        .createSignedUrl(screenshot.storage_path, 60);
      if (error || !data?.signedUrl) {
        setScreenshotError('Could not load the screenshot. Close and try again.');
      } else {
        setScreenshotSignedUrl(data.signedUrl);
      }
    } catch {
      setScreenshotError('Could not load the screenshot. Close and try again.');
    } finally {
      setLoadingScreenshot(false);
    }
  };

  const handleMarkReceived = (fee: MonthlyFee) => {
    const balance = fee.balance ?? Math.max(0, fee.amount_due - (fee.amount_paid || 0));
    setPaymentInitialMethod('upi');
    setPaymentInitialAmount(balance);
    setSelectedFeeForPayment(fee);
  };

  const handleRecordPayment = (fee: MonthlyFee) => {
    setPaymentInitialMethod(undefined);
    setPaymentInitialAmount(undefined);
    setSelectedFeeForPayment(fee);
  };

  const handleMarkScreenshotReviewed = async (id: string) => {
    try {
      const { error } = await supabase
        .from('payment_screenshots')
        .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (!error) {
        await fetchPendingScreenshots();
      } else {
        alert('Failed to mark reviewed: ' + error.message);
      }
    } catch {
      alert('Failed to mark reviewed.');
    }
  };

  const handleDeleteScreenshot = async (screenshot: PaymentScreenshot) => {
    if (!confirm('Are you sure you want to delete this screenshot?')) return;
    try {
      await supabase.storage.from('payment-screenshots').remove([screenshot.storage_path]);
      await supabase.from('payment_screenshots').delete().eq('id', screenshot.id);
      await fetchPendingScreenshots();
    } catch {
      alert('Failed to delete screenshot.');
    }
  };

  const getScreenshotFeeId = (s: PaymentScreenshot): string | undefined =>
    s.payment_link?.fee_id || s.payment_link?.monthly_fee_id || s.payment_link?.monthly_fee?.id;

  const feeIdsWithScreenshot = React.useMemo(() => {
    const set = new Set<string>();
    pendingScreenshots.forEach((s) => {
      const feeId = getScreenshotFeeId(s);
      if (feeId) {
        set.add(feeId);
      }
    });
    return set;
  }, [pendingScreenshots]);

  const screenshotsByFeeId = React.useMemo(() => {
    const map = new Map<string, PaymentScreenshot>();
    pendingScreenshots.forEach((s) => {
      const feeId = getScreenshotFeeId(s);
      if (feeId) {
        map.set(feeId, s);
      }
    });
    return map;
  }, [pendingScreenshots]);

  // Load batches on mount
  useEffect(() => {
    getBatches().then(({ batches: list }) => {
      setBatches(list);
    });
  }, []);

  // Fetch monthly fees & summary
  const fetchMonthlyData = useCallback(async () => {
    setLoadingFees(true);
    try {
      const [feesRes, summaryRes] = await Promise.all([
        getMonthlyFees(selectedMonth, {
          batchId: batchFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: searchQuery,
        }),
        getMonthlyFinancialSummary(selectedMonth),
      ]);

      if (feesRes.fees) setMonthlyFees(feesRes.fees);
      if (summaryRes.summary) setFinancialSummary(summaryRes.summary);
      await fetchPendingScreenshots();
    } finally {
      setLoadingFees(false);
    }
  }, [selectedMonth, batchFilter, statusFilter, searchQuery]);

  // Fetch overdue fees
  const fetchOverdueData = useCallback(async () => {
    setLoadingOverdue(true);
    try {
      const { fees } = await getOverdueFees();
      setOverdueFees(fees);
    } finally {
      setLoadingOverdue(false);
    }
  }, []);

  // Fetch payment history
  const fetchHistoryData = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { payments: list } = await getPaymentHistory({
        method: historyMethodFilter === 'all' ? undefined : historyMethodFilter,
        search: historySearch,
        startDate: historyStartDate || undefined,
        endDate: historyEndDate || undefined,
      });
      setPayments(list);
    } finally {
      setLoadingHistory(false);
    }
  }, [historyMethodFilter, historySearch, historyStartDate, historyEndDate]);

  // Fetch analytics data
  const fetchAnalyticsData = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const { data } = await get12MonthIncomeReport();
      setIncomeReportData(data);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  // Trigger loads based on active tab
  useEffect(() => {
    if (activeTab === 'monthly') {
      fetchMonthlyData();
    } else if (activeTab === 'overdue') {
      fetchOverdueData();
    } else if (activeTab === 'history') {
      fetchHistoryData();
    } else if (activeTab === 'analytics') {
      fetchAnalyticsData();
    }
  }, [activeTab, fetchMonthlyData, fetchOverdueData, fetchHistoryData, fetchAnalyticsData]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(getBillingMonthDateString(prevDate));
    setGenerateResult(null);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(getBillingMonthDateString(nextDate));
    setGenerateResult(null);
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(getBillingMonthDateString(new Date()));
    setGenerateResult(null);
  };

  // Generate fees handler
  const handleGenerateFees = async () => {
    setIsGenerating(true);
    setGenerateResult(null);
    try {
      const { count, error } = await generateMonthlyFees(selectedMonth);
      if (error) {
        setGenerateResult(`Error: ${error}`);
      } else if (count === 0) {
        setGenerateResult(`All active students already have fee records for ${formatBillingMonth(selectedMonth)}.`);
      } else {
        setGenerateResult(
          `Successfully generated ${count} fee record${count > 1 ? 's' : ''} for ${formatBillingMonth(selectedMonth)}!`
        );
      }
      fetchMonthlyData();
    } finally {
      setIsGenerating(false);
    }
  };

  // On payment success: refresh and open receipt
  const handlePaymentSuccess = (payment: Payment) => {
    fetchMonthlyData();
    if (activeTab === 'overdue') fetchOverdueData();
    if (activeTab === 'history') fetchHistoryData();

    // Determine balance remaining
    const matchingFee = monthlyFees.find((f) => f.id === payment.monthly_fee_id);
    const remaining = matchingFee
      ? Math.max(0, matchingFee.amount_due - ((matchingFee.amount_paid || 0) + payment.amount))
      : 0;

    setReceiptBalanceRemaining(remaining);
    setSelectedPaymentForReceipt(payment);
  };

  const renderStatusBadge = (status?: FeeStatus, amountPaid = 0, amountDue = 0, daysOverdue = 0) => {
    switch (status) {
      case 'paid':
        return (
          <Badge variant="success" size="sm" dot>
            Paid
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="warning" size="sm" dot>
            Partial ({formatIndianCurrency(amountPaid)} / {formatIndianCurrency(amountDue)})
          </Badge>
        );
      case 'overdue':
        return (
          <Badge variant="danger" size="sm" dot>
            Overdue ({daysOverdue}d)
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge variant="neutral" size="sm" dot>
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Title & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <DollarSign className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Fees &amp; Payments
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track student monthly dues, record payments, print receipts, and send WhatsApp reminders.
          </p>
        </div>

        {/* Quick Tabs */}
        <div className="w-full sm:w-auto">
          <Tabs
            tabs={[
              { id: 'monthly', label: 'Monthly Fees', icon: Calendar },
              {
                id: 'overdue',
                label: 'Overdue',
                icon: AlertTriangle,
                badge: overdueFees.length > 0 ? String(overdueFees.length) : undefined,
              },
              { id: 'history', label: 'Payment History', icon: History },
              { id: 'analytics', label: 'Overview & Reports', icon: TrendingUp },
            ]}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as any)}
          />
        </div>
      </div>

      {/* ==============================================================================
          TAB 1: MONTHLY FEES VIEW
         ============================================================================== */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          {/* Month Selector Bar & Generate Button */}
          <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 w-full lg:w-auto">
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                  icon={ChevronLeft}
                />
                <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white px-2 sm:px-3 text-center">
                  {formatBillingMonth(selectedMonth)}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleNextMonth}
                  aria-label="Next Month"
                  icon={ChevronRight}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCurrentMonth}
                className="text-xs text-indigo-600 dark:text-indigo-400"
              >
                Current Month
              </Button>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
              <Button
                variant="primary"
                onClick={handleGenerateFees}
                loading={isGenerating}
                icon={Sparkles}
                className="w-full lg:w-auto"
              >
                Generate Fees
              </Button>
            </div>
          </div>

          {/* Feedback from fee generation */}
          {generateResult && (
            <div
              className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 ${
                generateResult.startsWith('Error')
                  ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{generateResult}</span>
              </div>
              <button
                onClick={() => setGenerateResult(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Summary Stat Cards */}
          {financialSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-4 sm:p-5 shadow-xs">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Expected
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                  {formatIndianCurrency(financialSummary.total_expected)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Active student obligations for this month
                </p>
              </div>

              <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-4 sm:p-5 shadow-xs">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Collected
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                  {formatIndianCurrency(financialSummary.total_collected)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {financialSummary.paid_students_count} students fully settled
                </p>
              </div>

              <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-4 sm:p-5 shadow-xs">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Pending
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
                  {formatIndianCurrency(financialSummary.total_pending)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {financialSummary.pending_students_count} pending or partial
                </p>
              </div>

              <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-4 sm:p-5 shadow-xs">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Collection Rate
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {financialSummary.total_expected > 0
                      ? Math.round(
                          (financialSummary.total_collected / financialSummary.total_expected) * 100
                        )
                      : 0}
                    %
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-400 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        financialSummary.total_expected > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (financialSummary.total_collected /
                                  financialSummary.total_expected) *
                                  100
                              )
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Screenshot Received Section (Feature A) */}
          {pendingScreenshots.length > 0 && (
            <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h3 className="text-sm sm:text-base font-semibold text-amber-900 dark:text-amber-200">
                    Payment Screenshots Received ({pendingScreenshots.length})
                  </h3>
                </div>
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  Review and confirm payments
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingScreenshots.map((screenshot) => {
                  const studentName =
                    screenshot.payment_link?.monthly_fee?.student?.full_name || 'Student';
                  const billingMonth = screenshot.payment_link?.monthly_fee?.billing_month
                    ? formatBillingMonth(screenshot.payment_link.monthly_fee.billing_month)
                    : 'Current Month';
                  const receivedTime = new Date(screenshot.created_at).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  });
                  return (
                    <div
                      key={screenshot.id}
                      className="bg-white dark:bg-[#131c2e] p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 flex flex-col justify-between gap-3 shadow-2xs"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                              {studentName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Billing: {billingMonth}
                            </p>
                          </div>
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-semibold px-2 py-0.5 rounded-full">
                            Pending
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                          Received: {receivedTime}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => handleOpenScreenshotModal(screenshot)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                          onClick={() => handleMarkScreenshotReviewed(screenshot.id)}
                        >
                          Mark Reviewed
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                          onClick={() => handleDeleteScreenshot(screenshot)}
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
          <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full lg:w-auto flex-1">
              {/* Search */}
              <div className="relative flex-1 min-w-0 sm:min-w-[180px]">
                <Input
                  type="search"
                  placeholder="e.g. Rahul Sharma"
                  aria-label="Search student or phone"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>

              {/* Batch Filter */}
              <div className="w-full sm:w-48">
                <Select
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Batches' },
                    ...batches.map((b) => ({ value: b.id, label: b.name })),
                  ]}
                />
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-40">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'paid', label: 'Paid' },
                    { value: 'partial', label: 'Partial' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'overdue', label: 'Overdue' },
                  ]}
                />
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={fetchMonthlyData}
              icon={RefreshCw}
              loading={loadingFees}
            >
              Refresh
            </Button>
          </div>

          {/* Fees Table / Cards */}
          {loadingFees ? (
            <div className="text-center py-16 bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl">
              <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Loading monthly fees...</p>
            </div>
          ) : monthlyFees.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title={`No fee records for ${formatBillingMonth(selectedMonth)}`}
              description="Click 'Generate Fees' above to populate fees for all active students."
              actionText="Generate Fees Now"
              onAction={handleGenerateFees}
            />
          ) : (
            <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl shadow-xs overflow-hidden">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#1a2540] border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Student</th>
                      <th className="px-6 py-3.5">Batch</th>
                      <th className="px-6 py-3.5">Fee Amount</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Due Date</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {monthlyFees.map((fee) => (
                      <tr key={fee.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {fee.student?.photo_url ? (
                              <img
                                src={fee.student.photo_url}
                                alt={fee.student.full_name}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-200 dark:border-indigo-900/50">
                                {fee.student?.full_name?.substring(0, 2).toUpperCase() || 'ST'}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {fee.student?.full_name}
                              </p>
                              <p className="text-xs text-slate-400 dark:text-slate-500">
                                {fee.student?.phone || fee.student?.guardian_phone || 'No phone'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {fee.student?.batch?.name || (
                            <span className="text-slate-400 dark:text-slate-500 italic">No Batch</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatIndianCurrency(fee.amount_due)}
                          </span>
                          {(fee.amount_paid || 0) > 0 && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                              Paid: {formatIndianCurrency(fee.amount_paid)}
                            </p>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            {renderStatusBadge(
                              fee.status,
                              fee.amount_paid,
                              fee.amount_due,
                              fee.days_overdue
                            )}
                            {feeIdsWithScreenshot.has(fee.id) && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                Screenshot Attached
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                          {formatDisplayDate(fee.due_date)}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {fee.status !== 'paid' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => handleRecordPayment(fee)}
                                  icon={PlusCircle}
                                >
                                  Record Payment
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleMarkReceived(fee)}
                                >
                                  Mark received
                                </Button>
                              </>
                            )}

                            {screenshotsByFeeId.has(fee.id) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenScreenshotModal(screenshotsByFeeId.get(fee.id)!)}
                              >
                                View screenshot
                              </Button>
                            )}

                            {(fee.balance ?? (fee.amount_due - (fee.amount_paid || 0))) > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPaymentRequestFee(fee)}
                                icon={QrCode}
                              >
                                Send payment request
                              </Button>
                            )}

                            {fee.payments && fee.payments.length > 0 && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  const latestPayment = fee.payments![fee.payments!.length - 1];
                                  setReceiptBalanceRemaining(fee.balance || 0);
                                  setSelectedPaymentForReceipt(latestPayment);
                                }}
                                icon={FileText}
                              >
                                Receipt
                              </Button>
                            )}

                            {fee.status !== 'paid' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setReminderFee(fee)}
                                icon={MessageSquare}
                                title="Send WhatsApp Reminder"
                                className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                              >
                                Remind
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card-Based View */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {monthlyFees.map((fee) => (
                  <div key={fee.id} className="p-4 space-y-3 bg-white dark:bg-[#131c2e]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {fee.student?.photo_url ? (
                          <img
                            src={fee.student.photo_url}
                            alt={fee.student.full_name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-200 dark:border-indigo-900/50">
                            {fee.student?.full_name?.substring(0, 2).toUpperCase() || 'ST'}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{fee.student?.full_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {fee.student?.batch?.name || 'No Batch'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {renderStatusBadge(
                          fee.status,
                          fee.amount_paid,
                          fee.amount_due,
                          fee.days_overdue
                        )}
                        {feeIdsWithScreenshot.has(fee.id) && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            Screenshot Attached
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-xl">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500">Amount Due:</span>
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                          {formatIndianCurrency(fee.amount_due)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500">Balance:</span>
                        <p className="font-semibold text-red-600 dark:text-red-400 text-sm">
                          {formatIndianCurrency(fee.balance || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                      {fee.status !== 'paid' && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleRecordPayment(fee)}
                            icon={PlusCircle}
                          >
                            Pay
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleMarkReceived(fee)}
                          >
                            Mark received
                          </Button>
                        </>
                      )}
                      {screenshotsByFeeId.has(fee.id) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenScreenshotModal(screenshotsByFeeId.get(fee.id)!)}
                        >
                          View screenshot
                        </Button>
                      )}
                      {(fee.balance ?? (fee.amount_due - (fee.amount_paid || 0))) > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPaymentRequestFee(fee)}
                          icon={QrCode}
                        >
                          Send payment request
                        </Button>
                      )}
                      {fee.payments && fee.payments.length > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const latestPayment = fee.payments![fee.payments!.length - 1];
                            setReceiptBalanceRemaining(fee.balance || 0);
                            setSelectedPaymentForReceipt(latestPayment);
                          }}
                          icon={FileText}
                        >
                          Receipt
                        </Button>
                      )}
                      {fee.status !== 'paid' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setReminderFee(fee)}
                          icon={MessageSquare}
                          title="Send WhatsApp Reminder"
                          className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                        >
                          Remind
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==============================================================================
          TAB 2: OVERDUE / LATE PAYMENTS
         ============================================================================== */}
      {activeTab === 'overdue' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                Overdue Student Dues
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Students with unpaid fees past their due date, sorted by longest overdue first.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchOverdueData}
              icon={RefreshCw}
              loading={loadingOverdue}
            >
              Refresh
            </Button>
          </div>

          {loadingOverdue ? (
            <div className="text-center py-16 bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl">
              <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Checking overdue records...</p>
            </div>
          ) : overdueFees.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All Caught Up!"
              description="There are currently no overdue payments across any student batch."
            />
          ) : (
            <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl shadow-xs overflow-hidden">
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#1a2540] border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Student</th>
                      <th className="px-6 py-3.5">Batch</th>
                      <th className="px-6 py-3.5">Billing Month</th>
                      <th className="px-6 py-3.5">Pending Amount</th>
                      <th className="px-6 py-3.5">Days Overdue</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {overdueFees.map((fee) => (
                      <tr key={fee.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                          {fee.student?.full_name}
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                            Ph: {fee.student?.guardian_phone || fee.student?.phone || 'N/A'}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {fee.student?.batch?.name || 'No Batch'}
                        </td>
                        <td className="px-6 py-4 text-slate-800 dark:text-slate-200 font-medium">
                          {formatBillingMonth(fee.billing_month)}
                        </td>
                        <td className="px-6 py-4 font-bold text-red-600 dark:text-red-400">
                          {formatIndianCurrency(fee.balance || 0)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            <Badge variant="danger" size="sm">
                              {fee.days_overdue} days overdue
                            </Badge>
                            {feeIdsWithScreenshot.has(fee.id) && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                Screenshot Attached
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleRecordPayment(fee)}
                              icon={PlusCircle}
                            >
                              Record Payment
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleMarkReceived(fee)}
                            >
                              Mark received
                            </Button>
                            {screenshotsByFeeId.has(fee.id) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenScreenshotModal(screenshotsByFeeId.get(fee.id)!)}
                              >
                                View screenshot
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPaymentRequestFee(fee)}
                              icon={QrCode}
                            >
                              Send payment request
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setReminderFee(fee)}
                              icon={MessageSquare}
                              className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                            >
                              WhatsApp
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {overdueFees.map((fee) => (
                  <div key={fee.id} className="p-4 space-y-3 bg-white dark:bg-[#131c2e]">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{fee.student?.full_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {fee.student?.batch?.name || 'No Batch'} •{' '}
                          {formatBillingMonth(fee.billing_month)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="danger" size="sm">
                          {fee.days_overdue}d overdue
                        </Badge>
                        {feeIdsWithScreenshot.has(fee.id) && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            Screenshot Attached
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-red-50/50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-100 dark:border-red-900/60">
                      <span className="text-slate-600 dark:text-slate-400">Pending Due:</span>
                      <span className="font-bold text-red-700 dark:text-red-400 text-sm">
                        {formatIndianCurrency(fee.balance || 0)}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleRecordPayment(fee)}
                        icon={PlusCircle}
                      >
                        Record Payment
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleMarkReceived(fee)}
                      >
                        Mark received
                      </Button>
                      {screenshotsByFeeId.has(fee.id) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenScreenshotModal(screenshotsByFeeId.get(fee.id)!)}
                        >
                          View screenshot
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPaymentRequestFee(fee)}
                        icon={QrCode}
                      >
                        Send payment request
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setReminderFee(fee)}
                        icon={MessageSquare}
                        className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                      >
                        WhatsApp
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==============================================================================
          TAB 3: PAYMENT HISTORY
         ============================================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* History Filters Bar */}
          <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
              {/* Search */}
              <div className="relative">
                <Input
                  label="Search Payment"
                  type="search"
                  placeholder="e.g. MWM-2026-000001"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>

              {/* Method Filter */}
              <div>
                <Select
                  label="Payment Method"
                  value={historyMethodFilter}
                  onChange={(e) => setHistoryMethodFilter(e.target.value as any)}
                  options={[
                    { value: 'all', label: 'All Methods' },
                    { value: 'cash', label: 'Cash' },
                    { value: 'upi', label: 'UPI' },
                    { value: 'bank_transfer', label: 'Bank Transfer' },
                    { value: 'card', label: 'Card' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </div>

              {/* Start Date */}
              <div>
                <Input
                  label="From Date"
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                />
              </div>

              {/* End Date */}
              <div>
                <Input
                  label="To Date"
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setHistorySearch('');
                  setHistoryMethodFilter('all');
                  setHistoryStartDate('');
                  setHistoryEndDate('');
                }}
              >
                Clear Filters
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchHistoryData}
                icon={RefreshCw}
                loading={loadingHistory}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Payments Table */}
          {loadingHistory ? (
            <div className="text-center py-16 bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl">
              <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Loading payment transactions...</p>
            </div>
          ) : payments.length === 0 ? (
            <EmptyState
              icon={History}
              title="No Payment Records Found"
              description="No payments match the specified search or filter criteria."
            />
          ) : (
            <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#1a2540] border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Receipt #</th>
                      <th className="px-6 py-3.5">Date</th>
                      <th className="px-6 py-3.5">Student</th>
                      <th className="px-6 py-3.5">Month</th>
                      <th className="px-6 py-3.5">Amount</th>
                      <th className="px-6 py-3.5">Method</th>
                      <th className="px-6 py-3.5">Notes</th>
                      <th className="px-6 py-3.5 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400 text-xs">
                          {p.receipt_number}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                          {formatDisplayDate(p.payment_date)}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                          {p.student?.full_name}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {p.monthly_fee?.billing_month
                            ? formatBillingMonth(p.monthly_fee.billing_month)
                            : '-'}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">
                          {formatIndianCurrency(p.amount)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="neutral" size="sm">
                            {p.method.toUpperCase().replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400 max-w-[150px] truncate">
                          {p.notes || '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedPaymentForReceipt(p);
                            }}
                            icon={FileText}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==============================================================================
          TAB 4: FINANCIAL OVERVIEW / REPORTS (RECHARTS)
         ============================================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Financial Performance &amp; Income Report
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monthly expected vs collected income breakdown for the last 12 months.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchAnalyticsData}
              icon={RefreshCw}
              loading={loadingAnalytics}
            >
              Refresh
            </Button>
          </div>

          {loadingAnalytics ? (
            <div className="text-center py-16 bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl">
              <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Generating financial reports...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Recharts Bar Chart Card (Last 6 Months Comparison) */}
              <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl p-6 shadow-xs">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Monthly Revenue: Expected vs Collected (Last 6 Months)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Comparing planned student fee amounts against actual realized cash flow.
                  </p>
                </div>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={incomeReportData.slice(-6)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#26324a' : '#E2E8F0'} />
                      <XAxis dataKey="monthStr" tick={{ fontSize: 12, fill: isDark ? '#a9b4c7' : '#64748B' }} />
                      <YAxis
                        tick={{ fontSize: 12, fill: isDark ? '#a9b4c7' : '#64748B' }}
                        tickFormatter={(value) => `₹${value / 1000}k`}
                      />
                      <Tooltip
                        formatter={(value: any) => [formatIndianCurrency(Number(value)), '']}
                        labelStyle={{ fontWeight: 'bold', color: isDark ? '#F1F5F9' : '#1E293B' }}
                        contentStyle={{
                          backgroundColor: isDark ? '#131c2e' : '#FFFFFF',
                          borderColor: isDark ? '#26324a' : '#E2E8F0',
                          borderRadius: '12px',
                          color: isDark ? '#F1F5F9' : '#1E293B',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      />
                      <Legend wrapperStyle={{ color: isDark ? '#F1F5F9' : '#1E293B' }} />
                      <Bar
                        dataKey="expected"
                        name="Total Expected"
                        fill={isDark ? '#475569' : '#a9b4c7'}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="collected"
                        name="Total Collected"
                        fill={isDark ? '#818cf8' : '#4F46E5'}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 12-Month Detailed Breakdown Table */}
              <div className="bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-[#26324a] bg-slate-50/70 dark:bg-[#1a2540]">
                  <h3 className="text-sm font-bold text-slate-900">
                    12-Month Financial Summary Table
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                        <th className="px-6 py-3">Month</th>
                        <th className="px-6 py-3">Expected</th>
                        <th className="px-6 py-3">Collected</th>
                        <th className="px-6 py-3">Uncollected / Pending</th>
                        <th className="px-6 py-3">Collection Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...incomeReportData].reverse().map((row) => {
                        const pending = Math.max(0, row.expected - row.collected);
                        const rate =
                          row.expected > 0 ? Math.round((row.collected / row.expected) * 100) : 0;
                        return (
                          <tr key={row.billingMonth} className="hover:bg-slate-50/50">
                            <td className="px-6 py-3.5 font-medium text-slate-900">
                              {row.monthStr}
                            </td>
                            <td className="px-6 py-3.5 text-slate-600">
                              {formatIndianCurrency(row.expected)}
                            </td>
                            <td className="px-6 py-3.5 font-semibold text-emerald-600">
                              {formatIndianCurrency(row.collected)}
                            </td>
                            <td className="px-6 py-3.5 text-red-600 font-medium">
                              {formatIndianCurrency(pending)}
                            </td>
                            <td className="px-6 py-3.5">
                              <Badge
                                variant={rate >= 90 ? 'success' : rate >= 50 ? 'warning' : 'neutral'}
                                size="sm"
                              >
                                {rate}%
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==============================================================================
          MODALS
         ============================================================================== */}

      {/* 1. Record Payment Modal */}
      <RecordPaymentModal
        isOpen={!!selectedFeeForPayment}
        onClose={() => {
          setSelectedFeeForPayment(null);
          setPaymentInitialMethod(undefined);
          setPaymentInitialAmount(undefined);
        }}
        fee={selectedFeeForPayment}
        initialMethod={paymentInitialMethod}
        initialAmount={paymentInitialAmount}
        onSuccess={handlePaymentSuccess}
      />

      {/* 2. Receipt Modal (Preview & PDF Download) */}
      <ReceiptModal
        isOpen={!!selectedPaymentForReceipt}
        onClose={() => setSelectedPaymentForReceipt(null)}
        payment={selectedPaymentForReceipt}
        balanceRemaining={receiptBalanceRemaining}
      />

      {/* 3. WhatsApp Reminder Modal */}
      <WhatsAppReminderModal
        isOpen={!!reminderFee}
        onClose={() => setReminderFee(null)}
        fee={reminderFee}
      />

      {/* 4. Payment Request Modal */}
      <PaymentRequestModal
        isOpen={!!paymentRequestFee}
        onClose={() => setPaymentRequestFee(null)}
        fee={paymentRequestFee}
      />

      {/* 5. Screenshot Preview Modal (Feature A) */}
      {selectedScreenshot && (
        <Modal
          isOpen={!!selectedScreenshot}
          onClose={() => {
            setSelectedScreenshot(null);
            setScreenshotSignedUrl(null);
            setScreenshotError(null);
          }}
          title="Payment Screenshot"
          description="Verification of student UPI payment"
          maxWidth="md"
        >
          <div className="space-y-4">
            {/* Meta details */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 dark:text-slate-500 font-medium">Student</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedScreenshot.payment_link?.monthly_fee?.student?.full_name || 'Student'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 font-medium">Billing Month</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedScreenshot.payment_link?.monthly_fee?.billing_month
                    ? formatBillingMonth(selectedScreenshot.payment_link.monthly_fee.billing_month)
                    : 'Current Month'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 font-medium">Uploaded</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {new Date(selectedScreenshot.created_at).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            </div>

            {/* Screenshot Image Container */}
            <div className="relative min-h-[220px] max-h-[50vh] flex items-center justify-center bg-slate-100 dark:bg-slate-900/50 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 p-2">
              {loadingScreenshot && (
                <div className="flex flex-col items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-indigo-600 rounded-full animate-spin" />
                  <span>Loading secure screenshot...</span>
                </div>
              )}

              {screenshotError && (
                <div className="p-4 text-center space-y-1">
                  <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                    {screenshotError}
                  </p>
                </div>
              )}

              {!loadingScreenshot && !screenshotError && screenshotSignedUrl && (
                <img
                  src={screenshotSignedUrl}
                  alt="Payment screenshot proof"
                  className="max-h-[46vh] w-auto max-w-full object-contain rounded-lg shadow-xs"
                  onError={() => setScreenshotError('Could not load the screenshot. Close and try again.')}
                />
              )}
            </div>

            {/* Action Buttons: Mark received and Close */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 w-full">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSelectedScreenshot(null);
                  setScreenshotSignedUrl(null);
                  setScreenshotError(null);
                }}
                className="w-full sm:w-auto"
              >
                Close
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  const feeId =
                    selectedScreenshot.payment_link?.fee_id ||
                    selectedScreenshot.payment_link?.monthly_fee_id;
                  const matchedFee =
                    monthlyFees.find((f) => f.id === feeId) ||
                    overdueFees.find((f) => f.id === feeId) ||
                    (selectedScreenshot.payment_link?.monthly_fee as MonthlyFee | undefined);

                  setSelectedScreenshot(null);
                  setScreenshotSignedUrl(null);
                  setScreenshotError(null);

                  if (matchedFee) {
                    handleMarkReceived(matchedFee);
                  }
                }}
                className="w-full sm:w-auto"
              >
                Mark received
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
