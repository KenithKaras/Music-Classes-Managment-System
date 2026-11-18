import React, { useEffect, useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Calendar,
  FileText,
  AlertTriangle,
  User,
  Phone,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Clock,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getBatches } from '../services/batchService';
import { getOrGenerateClassesForRange } from '../services/classService';
import {
  getMonthlyAttendanceReport,
  getNeedsAttentionStudents,
  getStudentsForClassAttendance,
  updateStudentAttendance,
  markAllStudentsPresent,
  type StudentAttendanceDraft,
} from '../services/attendanceService';
import { exportBatchAttendance } from '../services/exportService';
import type {
  Batch,
  ClassSession,
  StudentMonthlyAttendance,
  ConsecutiveAbsenceStudent,
  AttendanceStatus,
} from '../types';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { Badge } from '../components/Badge';
import { Tabs } from '../components/Tabs';
import { Table } from '../components/Table';
import { EmptyState } from '../components/EmptyState';
import {
  formatDateYmd,
  getAttendanceStatusBadge,
} from '../utils/attendanceUtils';
import { formatDisplayDate, formatDisplayTime } from '../utils/formUtils';

export const AttendancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'today' | 'reports'>('today');
  const [batches, setBatches] = useState<Batch[]>([]);

  // Tab 1: Today states
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateYmd(new Date()));
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [dateClasses, setDateClasses] = useState<ClassSession[]>([]);
  const [loadingDateClasses, setLoadingDateClasses] = useState(false);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  // Per-class roster state: classId -> drafts
  const [classRosters, setClassRosters] = useState<Record<string, StudentAttendanceDraft[]>>({});
  const [loadingRoster, setLoadingRoster] = useState<string | null>(null);
  const [savedIndicator, setSavedIndicator] = useState<string | null>(null);

  // Needs Attention state
  const [needsAttentionList, setNeedsAttentionList] = useState<ConsecutiveAbsenceStudent[]>([]);

  // Tab 2: Reports states
  const [reportBatchId, setReportBatchId] = useState<string>('');
  const [reportYear, setReportYear] = useState<number>(() => new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [monthlyReport, setMonthlyReport] = useState<StudentMonthlyAttendance[]>([]);
  const [totalBatchClasses, setTotalBatchClasses] = useState<number>(0);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const todayStr = useMemo(() => formatDateYmd(new Date()), []);
  const isPastDate = selectedDate < todayStr;
  const isFutureDate = selectedDate > todayStr;

  // Load batches and needs-attention list on mount
  useEffect(() => {
    getBatches().then(({ batches: list }) => {
      setBatches(list);
      if (list.length > 0) {
        setReportBatchId(list[0].id);
      }
    });

    getNeedsAttentionStudents().then((res) => {
      // Only students who missed 3 or more consecutive classes
      const filtered = (res.students || []).filter((s) => s.consecutive_absences >= 3);
      setNeedsAttentionList(filtered);
    });
  }, []);

  // 1. Load classes for the chosen date & batch
  const loadDateClasses = async () => {
    if (!selectedDate) return;
    setLoadingDateClasses(true);
    const filterBatch = selectedBatchId === 'all' ? undefined : selectedBatchId;
    const res = await getOrGenerateClassesForRange(selectedDate, selectedDate, filterBatch);
    setDateClasses(res.classes);

    // If there is only one active class, expand it by default
    const activeFirst = res.classes.find((c) => c.status !== 'cancelled');
    if (activeFirst && !expandedClassId) {
      setExpandedClassId(activeFirst.id);
      loadClassRoster(activeFirst.id);
    }

    setLoadingDateClasses(false);
  };

  useEffect(() => {
    if (activeTab === 'today') {
      loadDateClasses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedBatchId, activeTab]);

  // Load roster for an individual class
  const loadClassRoster = async (classId: string) => {
    if (classRosters[classId]) return; // already loaded

    setLoadingRoster(classId);
    const res = await getStudentsForClassAttendance(classId);
    if (!res.error) {
      setClassRosters((prev) => ({ ...prev, [classId]: res.students }));
    }
    setLoadingRoster(null);
  };

  const handleToggleClass = (cls: ClassSession) => {
    if (cls.status === 'cancelled') return;

    if (expandedClassId === cls.id) {
      setExpandedClassId(null);
    } else {
      setExpandedClassId(cls.id);
      loadClassRoster(cls.id);
    }
  };

  // Date Navigation
  const handlePrevDay = () => {
    const parts = selectedDate.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() - 1);
    setSelectedDate(formatDateYmd(d));
  };

  const handleNextDay = () => {
    const parts = selectedDate.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + 1);
    setSelectedDate(formatDateYmd(d));
  };

  // Auto-Save Attendance on Tap
  const handleAttendanceTap = async (
    classId: string,
    studentId: string,
    targetStatus: AttendanceStatus
  ) => {
    if (isFutureDate) return; // Future dates cannot be marked

    const currentRoster = classRosters[classId] || [];
    const currentStudent = currentRoster.find((d) => d.student.id === studentId);
    const currentStatus = currentStudent?.status || null;

    // Tapping the selected button clears it
    const newStatus: AttendanceStatus | null = currentStatus === targetStatus ? null : targetStatus;

    // Optimistically update UI
    setClassRosters((prev) => ({
      ...prev,
      [classId]: (prev[classId] || []).map((d) =>
        d.student.id === studentId ? { ...d, status: newStatus } : d
      ),
    }));

    // Trigger auto-save
    const res = await updateStudentAttendance(classId, studentId, newStatus);
    if (!res.error) {
      setSavedIndicator(classId);
      setTimeout(() => setSavedIndicator(null), 2000);
    }
  };

  // Mark all present
  const handleMarkAllPresent = async (classId: string) => {
    if (isFutureDate) return;

    const currentRoster = classRosters[classId] || [];
    const studentIds = currentRoster.map((d) => d.student.id);

    // Optimistically update UI
    setClassRosters((prev) => ({
      ...prev,
      [classId]: (prev[classId] || []).map((d) => ({ ...d, status: 'present' })),
    }));

    const res = await markAllStudentsPresent(classId, studentIds);
    if (!res.error) {
      setSavedIndicator(classId);
      setTimeout(() => setSavedIndicator(null), 2000);
    }
  };

  // 2. Load Monthly Report (Tab 2)
  const loadMonthlyReport = async () => {
    if (!reportBatchId) return;
    setLoadingMonthly(true);
    const res = await getMonthlyAttendanceReport(reportBatchId, reportYear, reportMonth);
    setMonthlyReport(res.report);
    setTotalBatchClasses(res.totalBatchClasses);
    setLoadingMonthly(false);
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      loadMonthlyReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reportBatchId, reportYear, reportMonth]);

  // Export handlers for Tab 2
  const handleExport = async (format: 'pdf' | 'docx') => {
    if (!reportBatchId) return;
    const batch = batches.find((b) => b.id === reportBatchId);
    const batchName = batch ? batch.name : 'Batch';

    if (format === 'pdf') setIsExportingPdf(true);
    else setIsExportingDocx(true);
    setReportFeedback(null);

    try {
      const res = await exportBatchAttendance(
        { batchId: reportBatchId, batchName, year: reportYear, month: reportMonth },
        format
      );
      if (!res.success) {
        setReportFeedback({ type: 'error', message: res.error || 'Failed to download report.' });
      } else {
        setReportFeedback({
          type: 'success',
          message: `${format.toUpperCase()} attendance report downloaded successfully!`,
        });
      }
    } finally {
      if (format === 'pdf') setIsExportingPdf(false);
      else setIsExportingDocx(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Two Tabs */}
      <div className="bg-white dark:bg-[#111A2B] rounded-xl border border-slate-200 dark:border-[#1F2A3D] p-5 sm:p-6 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Attendance Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Mark daily class rosters, track monthly attendance percentages, and flag consecutive absences.
          </p>
        </div>

        {/* Two Tabs: Today and Reports */}
        <div className="mt-6">
          <Tabs
            tabs={[
              { id: 'today', label: 'Today', icon: ClipboardCheck },
              { id: 'reports', label: 'Reports', icon: FileText },
            ]}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as 'today' | 'reports')}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TODAY */}
      {/* ========================================================================= */}
      {activeTab === 'today' && (
        <div className="space-y-6">
          {/* Needs Attention Card (missed >= 3 consecutive classes in their batch) */}
          {needsAttentionList.length > 0 && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                  Needs Attention — Consecutive Absences ({needsAttentionList.length})
                </h2>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                The following students have missed 3 or more consecutive classes in their batch. Quick contact recommended:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {needsAttentionList.map((st) => (
                  <div
                    key={`${st.student_id}-${st.batch_id}`}
                    className="p-3 rounded-xl bg-white dark:bg-[#111A2B] border border-rose-200 dark:border-rose-900/50 shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {st.student_name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {st.batch_name}
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                        {st.consecutive_absences} classes missed
                      </span>
                    </div>

                    {st.phone && (
                      <a
                        href={`tel:${st.phone}`}
                        className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 transition-colors"
                        title={`Call ${st.student_name}`}
                        aria-label={`Call ${st.student_name}`}
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Date Picker & Batch Filter Card */}
          <div className="bg-white dark:bg-[#111A2B] border border-slate-200 dark:border-[#1F2A3D] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Date Navigation & Native Picker */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrevDay}
                  aria-label="Previous Day"
                  className="min-h-[44px] min-w-[44px]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="relative flex items-center">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    aria-label="Select Date"
                  />
                  <div className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 cursor-pointer min-h-[44px]">
                    <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{formatDisplayDate(selectedDate)}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleNextDay}
                  aria-label="Next Day"
                  className="min-h-[44px] min-w-[44px]"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

                {selectedDate !== todayStr && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDate(todayStr)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 min-h-[44px]"
                  >
                    Today
                  </Button>
                )}
              </div>

              {/* Batch Filter */}
              <div className="w-full md:w-64">
                <Select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Batches' },
                    ...batches.map((b) => ({ value: b.id, label: b.name })),
                  ]}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Past/Future Date Notices */}
            {isPastDate && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Editing a past date. All attendance changes auto-save immediately.</span>
              </div>
            )}

            {isFutureDate && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Future dates cannot be marked. Showing scheduled sessions for reference only.</span>
              </div>
            )}
          </div>

          {/* Classes List */}
          {loadingDateClasses ? (
            <div className="py-12 bg-white dark:bg-[#111A2B] rounded-2xl border border-slate-200 dark:border-[#1F2A3D] text-center">
              <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading classes...</p>
            </div>
          ) : dateClasses.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No classes scheduled for this date"
              description="No active batches or classes match the chosen date and batch filter."
            />
          ) : (
            <div className="space-y-4">
              {dateClasses.map((cls) => {
                const isCancelled = cls.status === 'cancelled';
                const isExpanded = expandedClassId === cls.id;
                const roster = classRosters[cls.id] || [];
                const isLoadingRoster = loadingRoster === cls.id;
                const isSaved = savedIndicator === cls.id;

                const presentCount = roster.filter((d) => d.status === 'present').length;
                const absentCount = roster.filter((d) => d.status === 'absent').length;
                const unmarkedCount = roster.filter((d) => d.status === null).length;

                return (
                  <div
                    key={cls.id}
                    className={`rounded-2xl border transition-all ${
                      isCancelled
                        ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                        : isExpanded
                        ? 'bg-white dark:bg-[#111A2B] border-indigo-400 dark:border-indigo-600/60 shadow-md ring-1 ring-indigo-500/20'
                        : 'bg-white dark:bg-[#111A2B] border-slate-200 dark:border-[#1F2A3D] hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                    }`}
                  >
                    {/* Class Card Header / Toggle Button */}
                    <div
                      role="button"
                      tabIndex={isCancelled ? -1 : 0}
                      onClick={() => handleToggleClass(cls)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleToggleClass(cls);
                        }
                      }}
                      className={`p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none ${
                        isCancelled ? 'cursor-not-allowed' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isCancelled
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          <ClipboardCheck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                              {cls.batch?.name || 'Class Session'}
                            </h3>
                            {isCancelled && <Badge variant="neutral" size="sm">Cancelled</Badge>}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5 text-indigo-500" />
                            <span>
                              {formatDisplayTime(cls.start_time)} – {formatDisplayTime(cls.end_time)}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Right indicator */}
                      {!isCancelled && (
                        <div className="flex items-center gap-3 shrink-0">
                          {cls.attendance_summary?.marked && (
                            <Badge variant="success" size="sm">Marked</Badge>
                          )}
                          <div className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Inline Expanded Student Roster */}
                    {isExpanded && !isCancelled && (
                      <div className="border-t border-slate-100 dark:border-slate-800 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-950/30 rounded-b-2xl space-y-4">
                        {isLoadingRoster ? (
                          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                            <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-700 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                            Loading batch students...
                          </div>
                        ) : roster.length === 0 ? (
                          <p className="py-6 text-center text-xs text-slate-400 italic">
                            No active students enrolled in this batch on or before this class date.
                          </p>
                        ) : (
                          <div className="space-y-4">
                            {/* Top Stats Bar & Auto-Save Indicator */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                  Present: {presentCount}
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
                                  Absent: {absentCount}
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  Not marked: {unmarkedCount}
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                {isSaved && (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Saved</span>
                                  </span>
                                )}

                                {!isFutureDate && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleMarkAllPresent(cls.id)}
                                    className="min-h-[44px]"
                                  >
                                    Mark all present
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Students List */}
                            <div className="space-y-2">
                              {roster.map((draft) => {
                                const st = draft.student;
                                const isPresent = draft.status === 'present';
                                const isAbsent = draft.status === 'absent';

                                return (
                                  <div
                                    key={st.id}
                                    className="p-3 rounded-xl bg-white dark:bg-[#111A2B] border border-slate-200 dark:border-[#1F2A3D] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                                        {st.photo_url ? (
                                          <img
                                            src={st.photo_url}
                                            alt={st.full_name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <User className="w-5 h-5 text-slate-400" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                                          {st.full_name}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                          Enrolled: {formatDisplayDate(st.enrollment_date)}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Present and Absent Buttons (min 44x44px touch targets) */}
                                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0 w-full sm:w-auto">
                                      <button
                                        type="button"
                                        disabled={isFutureDate}
                                        onClick={() => handleAttendanceTap(cls.id, st.id, 'present')}
                                        className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold text-xs min-h-[44px] min-w-[44px] sm:min-w-[90px] flex items-center justify-center gap-1.5 transition-all ${
                                          isPresent
                                            ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/40'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600'
                                        } ${isFutureDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      >
                                        <Check className="w-4 h-4" />
                                        <span>Present</span>
                                      </button>

                                      <button
                                        type="button"
                                        disabled={isFutureDate}
                                        onClick={() => handleAttendanceTap(cls.id, st.id, 'absent')}
                                        className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold text-xs min-h-[44px] min-w-[44px] sm:min-w-[90px] flex items-center justify-center gap-1.5 transition-all ${
                                          isAbsent
                                            ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-500/40'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600'
                                        } ${isFutureDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      >
                                        <X className="w-4 h-4" />
                                        <span>Absent</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REPORTS */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Controls Card */}
          <div className="bg-white dark:bg-[#111A2B] border border-slate-200 dark:border-[#1F2A3D] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Monthly Student Attendance Summary
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pick a batch, month, and year to review student attendance rates (Classes held: {totalBatchClasses}) and download reports.
                </p>
              </div>

              {/* Download Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={isExportingPdf}
                  disabled={isExportingPdf || isExportingDocx || !reportBatchId}
                  onClick={() => handleExport('pdf')}
                  icon={Download}
                  className="min-h-[44px]"
                >
                  Download PDF
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={isExportingDocx}
                  disabled={isExportingPdf || isExportingDocx || !reportBatchId}
                  onClick={() => handleExport('docx')}
                  icon={Download}
                  className="min-h-[44px]"
                >
                  Download Word
                </Button>
              </div>
            </div>

            {/* Filter selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Select
                label="Select Batch"
                value={reportBatchId}
                onChange={(e) => setReportBatchId(e.target.value)}
                options={batches.map((b) => ({ value: b.id, label: b.name }))}
              />
              <Select
                label="Month"
                value={String(reportMonth)}
                onChange={(e) => setReportMonth(parseInt(e.target.value, 10))}
                options={[
                  { value: '1', label: 'January' },
                  { value: '2', label: 'February' },
                  { value: '3', label: 'March' },
                  { value: '4', label: 'April' },
                  { value: '5', label: 'May' },
                  { value: '6', label: 'June' },
                  { value: '7', label: 'July' },
                  { value: '8', label: 'August' },
                  { value: '9', label: 'September' },
                  { value: '10', label: 'October' },
                  { value: '11', label: 'November' },
                  { value: '12', label: 'December' },
                ]}
              />
              <Select
                label="Year"
                value={String(reportYear)}
                onChange={(e) => setReportYear(parseInt(e.target.value, 10))}
                options={[2024, 2025, 2026, 2027].map((y) => ({ value: String(y), label: String(y) }))}
              />
            </div>

            {/* Feedback notification */}
            {reportFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between ${
                  reportFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
                }`}
              >
                <span>{reportFeedback.message}</span>
                <button
                  type="button"
                  onClick={() => setReportFeedback(null)}
                  className="font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Report Summary Table */}
          {loadingMonthly ? (
            <div className="py-12 bg-white dark:bg-[#111A2B] rounded-2xl border border-slate-200 dark:border-[#1F2A3D] text-center">
              <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Generating monthly report...</p>
            </div>
          ) : monthlyReport.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No attendance records found"
              description="No classes or attendance were recorded for this batch in the selected month."
            />
          ) : (
            <div className="bg-white dark:bg-[#111A2B] border border-slate-200 dark:border-[#1F2A3D] rounded-2xl shadow-xs overflow-hidden">
              <Table>
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-[#1F2A3D]">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Student Name
                    </th>
                    <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Classes Held
                    </th>
                    <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Present
                    </th>
                    <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Absent
                    </th>
                    <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Attendance %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                  {monthlyReport.map((r) => (
                    <tr key={r.student_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                            {r.photo_url ? (
                              <img src={r.photo_url} alt={r.student_name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {r.student_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-slate-700 dark:text-slate-300">
                        {r.total_classes}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                        {r.present_count}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-rose-700 dark:text-rose-400">
                        {r.absent_count}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <Badge variant={getAttendanceStatusBadge(r.percentage, r.total_classes).variant} size="sm">
                          {r.percentage}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
