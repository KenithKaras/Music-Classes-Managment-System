import { describe, it, expect } from 'vitest';
import {
  calculateAttendancePercentage,
  getAttendanceStatusBadge,
  calculateConsecutiveAbsences,
  isNeedsAttention,
  formatTimeAmPm,
  getDayOfWeek,
  getWeekDates,
  getAttendanceRowState,
  formatMarkedTime,
} from './attendanceUtils';

describe('calculateAttendancePercentage', () => {
  it('returns 0 when total classes is 0 or negative', () => {
    expect(calculateAttendancePercentage(0, 0)).toBe(0);
    expect(calculateAttendancePercentage(5, 0)).toBe(0);
    expect(calculateAttendancePercentage(0, -5)).toBe(0);
  });

  it('returns 0 when present classes is 0 or negative', () => {
    expect(calculateAttendancePercentage(0, 10)).toBe(0);
    expect(calculateAttendancePercentage(-2, 10)).toBe(0);
  });

  it('returns 100 when present equals total or exceeds total', () => {
    expect(calculateAttendancePercentage(10, 10)).toBe(100);
    expect(calculateAttendancePercentage(12, 10)).toBe(100);
  });

  it('correctly calculates and rounds percentage to 1 decimal place', () => {
    expect(calculateAttendancePercentage(8, 10)).toBe(80);
    expect(calculateAttendancePercentage(3, 4)).toBe(75);
    expect(calculateAttendancePercentage(7, 9)).toBe(77.8);
    expect(calculateAttendancePercentage(1, 3)).toBe(33.3);
  });
});

describe('getAttendanceStatusBadge', () => {
  it('returns neutral badge when there are 0 classes', () => {
    const badge = getAttendanceStatusBadge(0, 0);
    expect(badge.variant).toBe('neutral');
  });

  it('returns success badge for >= 80%', () => {
    expect(getAttendanceStatusBadge(80, 10).variant).toBe('success');
    expect(getAttendanceStatusBadge(100, 10).variant).toBe('success');
  });

  it('returns warning badge for 60% - 79.9%', () => {
    expect(getAttendanceStatusBadge(79.9, 10).variant).toBe('warning');
    expect(getAttendanceStatusBadge(60, 10).variant).toBe('warning');
  });

  it('returns danger badge for < 60%', () => {
    expect(getAttendanceStatusBadge(59.9, 10).variant).toBe('danger');
    expect(getAttendanceStatusBadge(20, 10).variant).toBe('danger');
  });
});

describe('calculateConsecutiveAbsences', () => {
  it('returns 0 for empty history', () => {
    expect(calculateConsecutiveAbsences([])).toBe(0);
  });

  it('returns 0 if the most recent class was attended (present)', () => {
    const history = [
      { status: 'present' as const },
      { status: 'absent' as const },
      { status: 'absent' as const },
    ];
    expect(calculateConsecutiveAbsences(history)).toBe(0);
  });

  it('counts consecutive absences from the most recent class backwards', () => {
    const history = [
      { status: 'absent' as const },
      { status: 'absent' as const },
      { status: 'absent' as const },
      { status: 'present' as const },
      { status: 'absent' as const },
    ];
    expect(calculateConsecutiveAbsences(history)).toBe(3);
  });

  it('counts all absences if student was absent in every recorded class', () => {
    const history = [
      { status: 'absent' as const },
      { status: 'absent' as const },
      { status: 'absent' as const },
      { status: 'absent' as const },
    ];
    expect(calculateConsecutiveAbsences(history)).toBe(4);
  });
});

describe('isNeedsAttention', () => {
  it('returns true when consecutive absences is 3 or more', () => {
    expect(isNeedsAttention(3)).toBe(true);
    expect(isNeedsAttention(5)).toBe(true);
  });

  it('returns false when consecutive absences is less than 3', () => {
    expect(isNeedsAttention(0)).toBe(false);
    expect(isNeedsAttention(1)).toBe(false);
    expect(isNeedsAttention(2)).toBe(false);
  });
});

describe('formatTimeAmPm', () => {
  it('formats 24-hour time to AM/PM correctly', () => {
    expect(formatTimeAmPm('09:30:00')).toBe('9:30 AM');
    expect(formatTimeAmPm('12:00:00')).toBe('12:00 PM');
    expect(formatTimeAmPm('16:00:00')).toBe('4:00 PM');
    expect(formatTimeAmPm('19:45')).toBe('7:45 PM');
    expect(formatTimeAmPm('00:15:00')).toBe('12:15 AM');
  });

  it('handles empty or missing input', () => {
    expect(formatTimeAmPm('')).toBe('');
    expect(formatTimeAmPm(null)).toBe('');
  });
});

describe('getDayOfWeek and getWeekDates', () => {
  it('identifies correct day of week', () => {
    // 2026-11-16 is a Monday, 2026-11-22 is a Sunday
    expect(getDayOfWeek('2026-11-16')).toBe('Mon');
    expect(getDayOfWeek('2026-11-18')).toBe('Wed');
    expect(getDayOfWeek('2026-11-22')).toBe('Sun');
  });

  it('calculates 7 dates of the week starting from Monday', () => {
    const week = getWeekDates('2026-11-18'); // Wednesday
    expect(week.startDate).toBe('2026-11-16'); // Monday
    expect(week.endDate).toBe('2026-11-22'); // Sunday
    expect(week.dates.length).toBe(7);
    expect(week.dates[0].dayOfWeek).toBe('Mon');
    expect(week.dates[6].dayOfWeek).toBe('Sun');
  });
});

describe('getAttendanceRowState (pure function for attendance row states)', () => {
  it('returns "unmarked" when there is no saved status, no pending choice, and not editing', () => {
    expect(getAttendanceRowState({ savedStatus: null, pendingStatus: null, isEditing: false })).toBe('unmarked');
    expect(getAttendanceRowState(null, null, false)).toBe('unmarked');
  });

  it('returns "pending" when a status is chosen regardless of previous state', () => {
    // Pending choice for unmarked student
    expect(getAttendanceRowState({ savedStatus: null, pendingStatus: 'present', isEditing: false })).toBe('pending');
    expect(getAttendanceRowState({ savedStatus: null, pendingStatus: 'absent', isEditing: false })).toBe('pending');

    // Pending choice while editing a previously saved row
    expect(getAttendanceRowState({ savedStatus: 'present', pendingStatus: 'absent', isEditing: true })).toBe('pending');
    expect(getAttendanceRowState({ savedStatus: 'absent', pendingStatus: 'present', isEditing: true })).toBe('pending');

    // Positional arguments
    expect(getAttendanceRowState('present', 'absent', true)).toBe('pending');
  });

  it('returns "saved" when status is saved, no pending choice, and not editing', () => {
    expect(getAttendanceRowState({ savedStatus: 'present', pendingStatus: null, isEditing: false })).toBe('saved');
    expect(getAttendanceRowState({ savedStatus: 'absent', pendingStatus: null, isEditing: false })).toBe('saved');
    expect(getAttendanceRowState('present', null, false)).toBe('saved');
  });

  it('returns "editing" when student has a saved status, isEditing is true, and no pending choice', () => {
    expect(getAttendanceRowState({ savedStatus: 'present', pendingStatus: null, isEditing: true })).toBe('editing');
    expect(getAttendanceRowState({ savedStatus: 'absent', pendingStatus: null, isEditing: true })).toBe('editing');
    expect(getAttendanceRowState('present', null, true)).toBe('editing');
  });

  it('returns "unmarked" if isEditing is true but savedStatus is null and no pending choice', () => {
    expect(getAttendanceRowState({ savedStatus: null, pendingStatus: null, isEditing: true })).toBe('unmarked');
  });

  it('restores "saved" state when editing is cancelled (isEditing set back to false)', () => {
    expect(getAttendanceRowState({ savedStatus: 'present', pendingStatus: null, isEditing: false })).toBe('saved');
  });

  it('restores original state when pending choice is cancelled', () => {
    // If was unmarked
    expect(getAttendanceRowState({ savedStatus: null, pendingStatus: null, isEditing: false })).toBe('unmarked');
    // If was editing
    expect(getAttendanceRowState({ savedStatus: 'present', pendingStatus: null, isEditing: true })).toBe('editing');
  });
});

describe('formatMarkedTime', () => {
  it('formats ISO timestamps to AM/PM format', () => {
    const timeStr = formatMarkedTime('2026-11-20T10:15:00.000Z');
    expect(timeStr).toMatch(/\d{1,2}:\d{2}\s+(AM|PM)/);
  });

  it('formats standard 24-hr time strings', () => {
    expect(formatMarkedTime('14:30:00')).toBe('2:30 PM');
    expect(formatMarkedTime('09:15')).toBe('9:15 AM');
  });

  it('returns empty string for null or empty input', () => {
    expect(formatMarkedTime(null)).toBe('');
    expect(formatMarkedTime('')).toBe('');
    expect(formatMarkedTime(undefined)).toBe('');
  });
});
