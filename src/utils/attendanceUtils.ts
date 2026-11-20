import type { DayOfWeek, AttendanceStatus } from '../types';

export type AttendanceRowState = 'unmarked' | 'pending' | 'saved' | 'editing';

export interface AttendanceRowStateInputs {
  savedStatus: AttendanceStatus | null;
  pendingStatus: AttendanceStatus | null;
  isEditing?: boolean;
}

/**
 * Pure function to determine a student's row state in the attendance roster.
 * Possible states: 'unmarked' | 'pending' | 'saved' | 'editing'
 */
export function getAttendanceRowState(
  inputsOrSavedStatus: AttendanceRowStateInputs | (AttendanceStatus | null),
  pendingStatus?: AttendanceStatus | null,
  isEditing?: boolean
): AttendanceRowState {
  let saved: AttendanceStatus | null = null;
  let pending: AttendanceStatus | null = null;
  let editing = false;

  if (typeof inputsOrSavedStatus === 'object' && inputsOrSavedStatus !== null) {
    saved = inputsOrSavedStatus.savedStatus;
    pending = inputsOrSavedStatus.pendingStatus;
    editing = Boolean(inputsOrSavedStatus.isEditing);
  } else {
    saved = inputsOrSavedStatus;
    pending = pendingStatus ?? null;
    editing = Boolean(isEditing);
  }

  if (pending !== null) {
    return 'pending';
  }
  if (editing && saved !== null) {
    return 'editing';
  }
  if (saved !== null) {
    return 'saved';
  }
  return 'unmarked';
}

/**
 * Formats marked_at or updated_at timestamp into 12-hour AM/PM format (e.g. "10:15 AM").
 */
export function formatMarkedTime(timestamp?: string | null): string {
  if (!timestamp) return '';
  if (timestamp.includes('T') || timestamp.includes('-') || timestamp.includes(' ')) {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
  }
  return formatTimeAmPm(timestamp);
}

/**
 * Calculates attendance percentage rounded to 1 decimal place.
 * Returns 0 if total classes is 0 or numbers are invalid.
 */
export function calculateAttendancePercentage(present: number, total: number): number {
  if (!total || total <= 0 || !present || present <= 0) {
    return 0;
  }
  if (present >= total) {
    return 100;
  }
  const percentage = (present / total) * 100;
  return Math.round(percentage * 10) / 10;
}

/**
 * Categorizes attendance percentage for badges and health indicators.
 */
export function getAttendanceStatusBadge(
  percentage: number,
  totalClasses: number
): {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'neutral';
} {
  if (totalClasses === 0) {
    return { label: 'No classes', variant: 'neutral' };
  }
  if (percentage >= 80) {
    return { label: 'Good (≥80%)', variant: 'success' };
  }
  if (percentage >= 60) {
    return { label: 'Average (60-79%)', variant: 'warning' };
  }
  return { label: 'Low (<60%)', variant: 'danger' };
}

/**
 * Calculates consecutive absences from recent class history.
 * History must be sorted with most recent class first.
 * Counts consecutive 'absent' marks backwards until the first 'present' is encountered.
 */
export function calculateConsecutiveAbsences(
  history: Array<{ status: 'present' | 'absent' }>
): number {
  let count = 0;
  for (const record of history) {
    if (record.status === 'absent') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Determines if a student needs attention due to consecutive absences (threshold >= 3).
 */
export function isNeedsAttention(consecutiveAbsences: number, threshold = 3): boolean {
  return consecutiveAbsences >= threshold;
}

/**
 * Converts a 24-hour time string ("16:00" or "16:00:00") into AM/PM format ("4:00 PM").
 */
export function formatTimeAmPm(timeStr?: string | null): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;

  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12

  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Returns 3-letter DayOfWeek for a given YYYY-MM-DD date string.
 */
export function getDayOfWeek(dateString: string): DayOfWeek {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayIndex = date.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const dayMap: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dayMap[dayIndex];
}

/**
 * Formats a Date object to YYYY-MM-DD.
 */
export function formatDateYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates start (Monday) and end (Sunday) of the week for any given date string or Date object.
 */
export function getWeekDates(currentDate: Date | string): {
  startDate: string; // Monday
  endDate: string; // Sunday
  dates: Array<{ dateStr: string; dayOfWeek: DayOfWeek; formatted: string }>;
} {
  const d = typeof currentDate === 'string' 
    ? new Date(currentDate.includes('T') ? currentDate : `${currentDate}T00:00:00`) 
    : new Date(currentDate);

  // Normalize to local midnight
  const day = d.getDay(); // 0 = Sun, 1 = Mon ...
  const diffToMonday = day === 0 ? -6 : 1 - day; // Monday is day 1

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const dates: Array<{ dateStr: string; dayOfWeek: DayOfWeek; formatted: string }> = [];

  for (let i = 0; i < 7; i++) {
    const loopDate = new Date(monday);
    loopDate.setDate(monday.getDate() + i);
    const dateStr = formatDateYmd(loopDate);
    const dayOfWeek = getDayOfWeek(dateStr);
    const formatted = loopDate.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    });

    dates.push({ dateStr, dayOfWeek, formatted });
  }

  return {
    startDate: dates[0].dateStr,
    endDate: dates[6].dateStr,
    dates,
  };
}
