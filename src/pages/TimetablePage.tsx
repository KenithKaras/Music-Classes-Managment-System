import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ClipboardCheck,
  Edit2,
  Trash2,
  Plus,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  Sliders,
} from 'lucide-react';
import {
  getClassesForRange,
  saveTimetableDraft,
} from '../services/classService';
import { getBatches } from '../services/batchService';
import { getAcademySettings, updateAcademySettings } from '../services/academyService';
import type {
  ClassSession,
  Batch,
  DraftClassSession,
  WorkingHoursConfig,
  DayOfWeek,
  TimetableDraftResult,
} from '../types';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MarkAttendanceModal } from '../components/MarkAttendanceModal';
import {
  getWeekDates,
  getDayOfWeek,
} from '../utils/attendanceUtils';
import {
  generateTimetableDraft,
  validateTimetable,
  timeToMinutes,
  minutesToTime,
  WEEKENDS,
  ALL_DAYS,
} from '../utils/timetableGenerator';
import { formatDisplayDate, formatDisplayTime } from '../utils/formUtils';

const DEFAULT_WORKING_CONFIG: WorkingHoursConfig = {
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  weekdayWindow: { startTime: '14:00', endTime: '21:00' },
  weekendWindow: { startTime: '10:00', endTime: '18:00' },
  minBreakMinutes: 10,
  maxClassesPerDay: null,
};

export const TimetablePage: React.FC = () => {
  // Navigation & Week State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'auto' | 'manual'>('auto');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [batches, setBatches] = useState<Batch[]>([]);

  // Working Hours Configuration
  const [workingConfig, setWorkingConfig] = useState<WorkingHoursConfig>(DEFAULT_WORKING_CONFIG);
  const [showConfigEditor, setShowConfigEditor] = useState(false);

  // Saved Database Classes
  const [savedClasses, setSavedClasses] = useState<ClassSession[]>([]);

  // In-Browser Draft State (Never written to DB until user confirms Save)
  const [draftClasses, setDraftClasses] = useState<DraftClassSession[]>([]);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftStats, setDraftStats] = useState<TimetableDraftResult['stats'] | null>(null);
  const [unplacedBatches, setUnplacedBatches] = useState<TimetableDraftResult['unplacedBatches']>([]);
  const [validationStatus, setValidationStatus] = useState<{ isValid: boolean; error: string | null }>({
    isValid: true,
    error: null,
  });

  // Action Modals State
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showDiscardConfirmModal, setShowDiscardConfirmModal] = useState(false);
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [attendanceTarget, setAttendanceTarget] = useState<ClassSession | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // Add Class Manual State
  const [newClassBatchId, setNewClassBatchId] = useState('');
  const [newClassDay, setNewClassDay] = useState<DayOfWeek>('Mon');
  const [newClassStartTime, setNewClassStartTime] = useState('15:00');
  const [manualAddError, setManualAddError] = useState<string | null>(null);

  // Date bounds for active week
  const weekInfo = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const formattedWeekRange = `${formatDisplayDate(weekInfo.startDate)} – ${formatDisplayDate(weekInfo.endDate)}`;

  // Load Batches & Settings on mount
  useEffect(() => {
    getBatches().then(({ batches }) => {
      setBatches(batches);
      if (batches.length > 0) setNewClassBatchId(batches[0].id);
    });

    getAcademySettings().then(({ settings }) => {
      if (settings?.working_hours_config) {
        setWorkingConfig(settings.working_hours_config);
      }
    });
  }, []);

  // Load Saved Classes for the week
  const loadSavedWeekClasses = async () => {
    const res = await getClassesForRange(weekInfo.startDate, weekInfo.endDate, selectedBatchId);
    if (!res.error) {
      setSavedClasses(res.classes);
    }
  };

  useEffect(() => {
    loadSavedWeekClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekInfo.startDate, weekInfo.endDate, selectedBatchId]);

  // Validate draft whenever draftClasses or workingConfig changes
  useEffect(() => {
    if (draftClasses.length > 0) {
      const v = validateTimetable(draftClasses, workingConfig);
      setValidationStatus(v);
    } else {
      setValidationStatus({ isValid: true, error: null });
    }
  }, [draftClasses, workingConfig]);

  // Unsaved draft warning on window unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasDraft) {
        e.preventDefault();
        e.returnValue = 'You have an unsaved timetable draft. Discard it?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasDraft]);

  // Week navigation
  const handlePrevWeek = () => {
    if (hasDraft) {
      if (!window.confirm('You have an unsaved draft for this week. Changing week will discard it. Continue?')) {
        return;
      }
      discardDraft();
    }
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
  };

  const handleNextWeek = () => {
    if (hasDraft) {
      if (!window.confirm('You have an unsaved draft for this week. Changing week will discard it. Continue?')) {
        return;
      }
      discardDraft();
    }
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  // Generate Draft Action (Pure client function)
  const handleGenerateDraft = () => {
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);

    const activeBatches = batches.map((b) => ({
      id: b.id,
      name: b.name,
      days_of_week: b.days_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
    }));

    const result = generateTimetableDraft(activeBatches, workingConfig);
    setDraftClasses(result.classes);
    setDraftStats(result.stats);
    setUnplacedBatches(result.unplacedBatches);
    setHasDraft(true);
  };

  const discardDraft = () => {
    setDraftClasses([]);
    setHasDraft(false);
    setDraftStats(null);
    setUnplacedBatches([]);
    setShowDiscardConfirmModal(false);
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);
  };

  // Manual Add Class to Draft
  const handleAddClassToDraft = (e: React.FormEvent) => {
    e.preventDefault();
    setManualAddError(null);

    const batch = batches.find((b) => b.id === newClassBatchId);
    if (!batch) return;

    const startMins = timeToMinutes(newClassStartTime);
    const duration = Math.max(30, timeToMinutes(batch.end_time) - timeToMinutes(batch.start_time));
    const endMins = startMins + duration;

    const newDraftItem: DraftClassSession = {
      tempId: `manual-${batch.id}-${newClassDay}-${startMins}`,
      batch_id: batch.id,
      batch_name: batch.name,
      day_of_week: newClassDay,
      start_time: minutesToTime(startMins),
      end_time: minutesToTime(endMins),
      duration_minutes: duration,
      is_weekend: WEEKENDS.includes(newClassDay),
    };

    const updated = [...draftClasses, newDraftItem];
    const validation = validateTimetable(updated, workingConfig);

    if (!validation.isValid) {
      setManualAddError(validation.error || 'Conflict detected');
      return;
    }

    setDraftClasses(updated);
    setHasDraft(true);
    setShowAddClassModal(false);
  };

  const handleRemoveDraftClass = (tempId: string) => {
    setDraftClasses((prev) => prev.filter((c) => c.tempId !== tempId));
  };

  // Execute Save to Database
  const handleExecuteSave = async () => {
    setIsSaving(true);
    setSaveErrorMessage(null);
    setSaveSuccessMessage(null);

    try {
      const res = await saveTimetableDraft(weekInfo.startDate, weekInfo.endDate, draftClasses);

      if (!res.success || res.error) {
        setSaveErrorMessage(res.error || 'Failed to save timetable to database.');
      } else {
        setSaveSuccessMessage(
          `Successfully saved ${res.createdCount} classes for ${formattedWeekRange}.` +
            (res.preservedClasses.length > 0
              ? ` (${res.preservedClasses.length} classes with marked attendance were kept intact).`
              : '')
        );
        setHasDraft(false);
        setDraftClasses([]);
        setDraftStats(null);
        setShowSaveConfirmModal(false);
        await loadSavedWeekClasses();
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Working Hours Config Update
  const handleSaveWorkingConfig = async () => {
    try {
      setWorkingConfig(workingConfig);
      setShowConfigEditor(false);
      await updateAcademySettings({
        working_hours_config: workingConfig,
      });
    } catch {
      // ignore
    }
  };

  const activeDaysToDisplay = ALL_DAYS.filter((d) =>
    workingConfig.workingDays.includes(d) ||
    draftClasses.some((c) => c.day_of_week === d) ||
    savedClasses.some((c) => getDayOfWeek(c.class_date) === d)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <CalendarIcon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              <span>Timetable &amp; Schedule</span>
            </h1>
            {hasDraft && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                Unsaved Browser Draft
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Build drafts risk-free. No classes are saved to the database until you confirm.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowConfigEditor(!showConfigEditor)}
            icon={Sliders}
          >
            Working Hours &amp; Days
          </Button>

          {hasDraft && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDiscardConfirmModal(true)}
                className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                Discard Draft
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setShowSaveConfirmModal(true)}
                icon={Save}
                disabled={!validationStatus.isValid}
              >
                Save Timetable
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mode Selector & Working Days Controls */}
      <div className="bg-white dark:bg-[#111A2B] border border-slate-200 dark:border-[#1F2A3D] rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Mode Tabs */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('auto')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all min-h-[38px] flex items-center justify-center gap-2 flex-1 sm:flex-initial ${
                viewMode === 'auto'
                  ? 'bg-white dark:bg-[#111A2B] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Auto-Generate Draft</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('manual')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all min-h-[38px] flex items-center justify-center gap-2 flex-1 sm:flex-initial ${
                viewMode === 'manual'
                  ? 'bg-white dark:bg-[#111A2B] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Edit2 className="w-4 h-4" />
              <span>Manual Editing</span>
            </button>
          </div>

          {/* Week Date Picker & Controls */}
          <div className="flex flex-wrap items-center gap-2 justify-between lg:justify-end w-full lg:w-auto">
            <div className="flex items-center gap-1 flex-1 sm:flex-initial justify-between sm:justify-start">
              <Button type="button" variant="outline" size="sm" onClick={handlePrevWeek} aria-label="Previous week">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 px-1 text-center truncate">
                {formattedWeekRange}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={handleNextWeek} aria-label="Next week">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="w-full sm:w-auto min-w-[130px]">
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
        </div>

        {/* Live Validation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            {validationStatus.isValid ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Timetable is valid (0 conflicts, breaks respected)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                {validationStatus.error}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
            <span>Active Days: {workingConfig.workingDays.join(', ')}</span>
            <span>&bull;</span>
            <span>Break: {workingConfig.minBreakMinutes}m</span>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessMessage(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification */}
      {saveErrorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{saveErrorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveErrorMessage(null)}
            className="text-rose-700 dark:text-rose-400 hover:underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Working Config Editor */}
      {showConfigEditor && (
        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Working Days &amp; Time Window Configuration</span>
            </h3>
            <Button type="button" variant="primary" size="sm" onClick={handleSaveWorkingConfig}>
              Apply &amp; Save
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Days Toggle */}
            <div className="sm:col-span-2 space-y-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Working Days (Mon-Fri default ON; Sat-Sun optional)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_DAYS.map((d) => {
                  const isChecked = workingConfig.workingDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        const updatedDays = isChecked
                          ? workingConfig.workingDays.filter((x) => x !== d)
                          : [...workingConfig.workingDays, d];
                        setWorkingConfig({ ...workingConfig, workingDays: updatedDays });
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold border transition-all ${
                        isChecked
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Min Break */}
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Min Break Between Classes
              </label>
              <Input
                type="number"
                min={0}
                max={60}
                value={workingConfig.minBreakMinutes}
                onChange={(e) =>
                  setWorkingConfig({
                    ...workingConfig,
                    minBreakMinutes: parseInt(e.target.value, 10) || 0,
                  })
                }
                helperText="Minutes (default 10)"
              />
            </div>
          </div>
        </div>
      )}

      {/* AUTO-GENERATE DRAFT CONTROLS & STATS */}
      {viewMode === 'auto' && (
        <div className="bg-white dark:bg-[#111A2B] border border-slate-200 dark:border-[#1F2A3D] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Auto-Generate Weekly Schedule Draft</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Optimized for: fewest teaching days and shortest idle time.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={handleGenerateDraft}
              icon={Sparkles}
              className="shrink-0"
            >
              {hasDraft ? 'Regenerate Draft' : 'Generate Draft'}
            </Button>
          </div>

          {/* Draft Summary Card */}
          {draftStats && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Total Teaching
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {draftStats.totalTeachingHours} hrs
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Campus Days
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {draftStats.teachingDaysCount} days
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Longest Idle Gap
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {draftStats.longestIdleGapMinutes}m
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Weekend Classes
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {draftStats.usedWeekend ? 'Yes (Utilized)' : 'None (Weekdays only)'}
                  </span>
                </div>
              </div>

              {/* Unplaced Batches Warning */}
              {unplacedBatches.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>Unplaced Batches ({unplacedBatches.length})</span>
                  </div>
                  <div className="space-y-1">
                    {unplacedBatches.map((u) => (
                      <div key={u.batch_id} className="flex flex-col sm:flex-row sm:gap-2">
                        <strong className="text-rose-950 dark:text-rose-100">{u.batch_name}:</strong>
                        <span>{u.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MANUAL MODE ACTIONS BAR */}
      {viewMode === 'manual' && (
        <div className="bg-white dark:bg-[#111A2B] border border-slate-200 dark:border-[#1F2A3D] rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span>Manual Mode: Click &quot;Add Class to Draft&quot; to place or adjust class slots.</span>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowAddClassModal(true)}
            icon={Plus}
          >
            Add Class to Draft
          </Button>
        </div>
      )}

      {/* TIMETABLE GRID (DRAFT OR SAVED CLASSES) */}
      <div className="bg-white dark:bg-[#111A2B] border border-slate-200 dark:border-[#1F2A3D] rounded-2xl p-4 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {hasDraft ? 'Weekly Draft Preview' : 'Saved Week Timetable'}
          </h2>

          {hasDraft ? (
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">
              {draftClasses.length} draft sessions
            </span>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {(() => {
                const scheduledCount = savedClasses.filter((c) => c.status !== 'cancelled').length;
                const cancelledCount = savedClasses.filter((c) => c.status === 'cancelled').length;
                return cancelledCount > 0
                  ? `${scheduledCount} classes (${cancelledCount} cancelled)`
                  : `${scheduledCount} classes`;
              })()}
            </span>
          )}
        </div>

        {/* Days Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4">
          {activeDaysToDisplay.map((day) => {
            const dayDraftClasses = draftClasses
              .filter((c) => c.day_of_week === day)
              .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

            const daySavedClasses = savedClasses
              .filter((c) => getDayOfWeek(c.class_date) === day)
              .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

            const isWeekend = WEEKENDS.includes(day);

            return (
              <div
                key={day}
                className={`rounded-2xl border p-4 flex flex-col justify-between min-h-[220px] transition-colors ${
                  isWeekend
                    ? 'bg-slate-50/60 dark:bg-slate-950/40 border-dashed border-slate-300 dark:border-slate-800'
                    : 'bg-slate-50/40 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/80 dark:border-slate-800">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {day} {isWeekend && <span className="text-[10px] text-indigo-500 font-semibold">(Weekend)</span>}
                    </span>

                    {hasDraft && dayDraftClasses.length > 0 && (
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        {dayDraftClasses.length}
                      </span>
                    )}
                  </div>

                  {/* Render Draft Classes */}
                  {hasDraft ? (
                    <div className="space-y-2.5">
                      {dayDraftClasses.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-600 italic py-4 text-center">
                          No classes draft
                        </p>
                      ) : (
                        dayDraftClasses.map((cls) => (
                          <div
                            key={cls.tempId}
                            className="p-3 rounded-xl bg-white dark:bg-[#111A2B] border border-indigo-200 dark:border-indigo-900/60 shadow-2xs space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {cls.batch_name}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftClass(cls.tempId)}
                                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 rounded-md min-h-[24px] min-w-[24px] flex items-center justify-center"
                                title="Remove class from draft"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              <Clock className="w-3.5 h-3.5 text-indigo-500" />
                              <span>
                                {formatDisplayTime(cls.start_time)} - {formatDisplayTime(cls.end_time)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    /* Render Saved Classes */
                    <div className="space-y-2.5">
                      {daySavedClasses.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-600 italic py-4 text-center">
                          No scheduled classes
                        </p>
                      ) : (
                        daySavedClasses.map((cls) => (
                          <div
                            key={cls.id}
                            className={`p-3 rounded-xl border shadow-2xs space-y-1.5 ${
                              cls.status === 'cancelled'
                                ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-70'
                                : 'bg-white dark:bg-[#111A2B] border-slate-200 dark:border-[#1F2A3D]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {cls.batch?.name || 'Class Session'}
                              </p>
                              {cls.status === 'cancelled' && (
                                <Badge variant="neutral" size="sm">Cancelled</Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              <Clock className="w-3.5 h-3.5 text-indigo-500" />
                              <span>
                                {formatDisplayTime(cls.start_time)} - {formatDisplayTime(cls.end_time)}
                              </span>
                            </div>

                            {/* Attendance trigger */}
                            {cls.status !== 'cancelled' && (
                              <div className="pt-1 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60">
                                <button
                                  type="button"
                                  onClick={() => setAttendanceTarget(cls)}
                                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 min-h-[32px]"
                                >
                                  <ClipboardCheck className="w-3 h-3" />
                                  <span>
                                    {cls.attendance_summary?.marked ? 'Attendance Marked' : 'Mark Attendance'}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Draft Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showSaveConfirmModal}
        onClose={() => setShowSaveConfirmModal(false)}
        onConfirm={handleExecuteSave}
        title="Confirm & Save Timetable"
        message={
          `This will create ${draftClasses.length} class sessions from ${weekInfo.startDate} to ${weekInfo.endDate}. ` +
          `Classes in this week that already have attendance marked will be preserved safely. ` +
          `Do you want to confirm and save?`
        }
        confirmText="Confirm and save"
        cancelText="Cancel"
        variant="primary"
        loading={isSaving}
      />

      {/* Discard Draft Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDiscardConfirmModal}
        onClose={() => setShowDiscardConfirmModal(false)}
        onConfirm={discardDraft}
        title="Discard Draft"
        message="You have an unsaved timetable draft in your browser. Are you sure you want to discard it? No changes have been written to the database."
        confirmText="Discard Draft"
        cancelText="Keep Draft"
        variant="danger"
      />

      {/* Add Class to Draft Modal (Manual Mode) */}
      <Modal
        isOpen={showAddClassModal}
        onClose={() => setShowAddClassModal(false)}
        title="Add Class Session to Draft"
      >
        <form onSubmit={handleAddClassToDraft} className="space-y-4">
          {manualAddError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
              {manualAddError}
            </div>
          )}

          <Select
            label="Select Music Batch"
            value={newClassBatchId}
            onChange={(e) => setNewClassBatchId(e.target.value)}
            options={batches.map((b) => ({
              value: b.id,
              label: `${b.name} (${b.start_time} - ${b.end_time})`,
            }))}
            required
          />

          <Select
            label="Day of Week"
            value={newClassDay}
            onChange={(e) => setNewClassDay(e.target.value as DayOfWeek)}
            options={ALL_DAYS.map((d) => ({
              value: d,
              label: d,
            }))}
            required
          />

          <Input
            label="Start Time"
            type="time"
            value={newClassStartTime}
            onChange={(e) => setNewClassStartTime(e.target.value)}
            required
            helperText="Duration is automatically computed from the batch's length."
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowAddClassModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add to Draft
            </Button>
          </div>
        </form>
      </Modal>

      {/* Mark Attendance Modal */}
      {attendanceTarget && (
        <MarkAttendanceModal
          isOpen={Boolean(attendanceTarget)}
          onClose={() => setAttendanceTarget(null)}
          classSession={attendanceTarget}
          onSuccess={() => {
            setAttendanceTarget(null);
            loadSavedWeekClasses();
          }}
        />
      )}
    </div>
  );
};
