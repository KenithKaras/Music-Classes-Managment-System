import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import {
  getStudentsForClassAttendance,
  saveClassAttendance,
  type StudentAttendanceDraft,
} from '../services/attendanceService';
import type { ClassSession, AttendanceStatus } from '../types';
import { Check, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatTimeAmPm } from '../utils/attendanceUtils';
import { StudentAvatar } from './StudentAvatar';

interface MarkAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  classSession: ClassSession | null;
  onSuccess: () => void;
}

export const MarkAttendanceModal: React.FC<MarkAttendanceModalProps> = ({
  isOpen,
  onClose,
  classSession,
  onSuccess,
}) => {
  const [drafts, setDrafts] = useState<StudentAttendanceDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !classSession) return;

    setLoading(true);
    setErrorMessage(null);

    getStudentsForClassAttendance(classSession.id).then((res) => {
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setDrafts(res.students);
      }
      setLoading(false);
    });
  }, [isOpen, classSession]);

  if (!classSession) return null;

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setDrafts((prev) =>
      prev.map((d) => (d.student.id === studentId ? { ...d, status } : d))
    );
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    setDrafts((prev) => prev.map((d) => ({ ...d, status })));
  };

  const handleSave = async () => {
    setErrorMessage(null);

    // Verify all or at least one is selected
    const unmarked = drafts.filter((d) => d.status === null);
    if (unmarked.length > 0) {
      if (
        !window.confirm(
          `${unmarked.length} student(s) are still unmarked. Any unmarked students will not be recorded. Continue?`
        )
      ) {
        return;
      }
    }

    const recordsToSave = drafts
      .filter((d) => d.status !== null)
      .map((d) => ({
        studentId: d.student.id,
        status: d.status as AttendanceStatus,
      }));

    if (recordsToSave.length === 0) {
      setErrorMessage('Please mark at least one student as Present or Absent.');
      return;
    }

    setIsSubmitting(true);
    const res = await saveClassAttendance(classSession.id, recordsToSave);
    setIsSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      onSuccess();
      onClose();
    }
  };

  const presentCount = drafts.filter((d) => d.status === 'present').length;
  const absentCount = drafts.filter((d) => d.status === 'absent').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Class Attendance"
      description={`${classSession.batch?.name || 'Class'} • ${classSession.class_date} (${formatTimeAmPm(
        classSession.start_time
      )} - ${formatTimeAmPm(classSession.end_time)})`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Error message */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Attendance Error</p>
              <p className="mt-0.5 text-red-800">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Quick Batch Actions & Counter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="success">Present: {presentCount}</Badge>
            <Badge variant="danger">Absent: {absentCount}</Badge>
            <span className="text-slate-500 dark:text-slate-400 font-medium">Total: {drafts.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleMarkAll('present')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1.5 rounded-lg transition-colors min-h-[36px]"
            >
              All Present
            </button>
            <button
              type="button"
              onClick={() => handleMarkAll('absent')}
              className="text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800/60 px-2.5 py-1.5 rounded-lg transition-colors min-h-[36px]"
            >
              All Absent
            </button>
          </div>
        </div>

        {/* Student Roster List */}
        {loading ? (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
            <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-slate-800 dark:border-t-slate-200 rounded-full animate-spin mx-auto mb-2" />
            Loading enrolled students...
          </div>
        ) : drafts.length === 0 ? (
          <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
            <p className="font-medium text-slate-700 dark:text-slate-300">No active students in this batch.</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Add or transfer students to this batch first to record their attendance.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[50vh] overflow-y-auto pr-1 space-y-1">
            {drafts.map(({ student, status }) => (
              <div
                key={student.id}
                className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 p-2 rounded-lg transition-colors"
              >
                {/* Student Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <StudentAvatar
                    photoUrl={student.photo_url}
                    name={student.full_name}
                    className="w-10 h-10"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                      {student.full_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 break-all">{student.phone || 'No phone'}</p>
                  </div>
                </div>

                {/* Touch-Friendly Status Selection Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(student.id, 'present')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all min-h-[42px] ${
                      status === 'present'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs ring-2 ring-emerald-600/30 dark:ring-emerald-400/40'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-200 dark:hover:border-emerald-800/60'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Present</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange(student.id, 'absent')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all min-h-[42px] ${
                      status === 'absent'
                        ? 'bg-red-600 text-white border-red-600 shadow-2xs ring-2 ring-red-600/30 dark:ring-red-400/40'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 hover:border-red-200 dark:hover:border-red-800/60'
                    }`}
                  >
                    <X className="w-4 h-4" />
                    <span>Absent</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            loading={isSubmitting}
            disabled={drafts.length === 0}
            icon={<CheckCircle2 className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Save Attendance
          </Button>
        </div>
      </div>
    </Modal>
  );
};
