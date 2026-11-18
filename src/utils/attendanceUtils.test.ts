import { describe, it, expect } from 'vitest';
import {
  calculateAttendancePercentage,
  getAttendanceStatusBadge,
  calculateConsecutiveAbsences,
  isNeedsAttention,
  formatTimeAmPm,
  getDayOfWeek,
  getWeekDates,
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
