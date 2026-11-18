import { describe, it, expect } from 'vitest';
import {
  generateTimetableDraft,
  validateTimetable,
  timeToMinutes,
  minutesToTime,
  type BatchToSchedule,
} from './timetableGenerator';
import type { WorkingHoursConfig } from '../types';

const defaultConfig: WorkingHoursConfig = {
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  weekdayWindow: { startTime: '14:00', endTime: '20:00' }, // 6 hours (360 mins)
  weekendWindow: { startTime: '10:00', endTime: '18:00' },
  minBreakMinutes: 10,
  maxClassesPerDay: null,
};

describe('Timetable Generator Algorithm', () => {
  it('converts time strings and minutes reliably', () => {
    expect(timeToMinutes('14:30')).toBe(14 * 60 + 30);
    expect(timeToMinutes('09:00:00')).toBe(9 * 60);
    expect(minutesToTime(14 * 60 + 30)).toBe('14:30');
    expect(minutesToTime(0)).toBe('00:00');
  });

  it('generates a draft with no overlaps and respects breaks between classes', () => {
    const batches: BatchToSchedule[] = [
      {
        id: 'b1',
        name: 'Piano Beginners',
        days_of_week: ['Mon', 'Wed'],
        start_time: '14:00',
        end_time: '15:00',
      },
      {
        id: 'b2',
        name: 'Guitar Intermediate',
        days_of_week: ['Mon', 'Wed'],
        start_time: '14:00', // same preferred time! should be packed with break
        end_time: '15:00',
      },
      {
        id: 'b3',
        name: 'Vocal Masterclass',
        days_of_week: ['Mon', 'Fri'],
        start_time: '15:30',
        end_time: '16:30',
      },
    ];

    const result = generateTimetableDraft(batches, defaultConfig);

    expect(result.isValid).toBe(true);
    expect(result.unplacedBatches.length).toBe(0);

    // Validate the resulting classes
    const validation = validateTimetable(result.classes, defaultConfig);
    expect(validation.isValid).toBe(true);
    expect(validation.error).toBeNull();

    // Check session counts
    const b1Sessions = result.classes.filter((c) => c.batch_id === 'b1');
    const b2Sessions = result.classes.filter((c) => c.batch_id === 'b2');
    const b3Sessions = result.classes.filter((c) => c.batch_id === 'b3');

    expect(b1Sessions.length).toBe(2);
    expect(b2Sessions.length).toBe(2);
    expect(b3Sessions.length).toBe(2);

    // Check that on Monday, every consecutive pair has at least 10 min break
    const monClasses = result.classes
      .filter((c) => c.day_of_week === 'Mon')
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

    expect(monClasses.length).toBe(3);
    for (let i = 0; i < monClasses.length - 1; i++) {
      const end = timeToMinutes(monClasses[i].end_time);
      const nextStart = timeToMinutes(monClasses[i + 1].start_time);
      expect(nextStart).toBeGreaterThanOrEqual(end + 10);
    }
  });

  it('uses weekdays first and prefers weekdays over weekends', () => {
    const configWithWeekends: WorkingHoursConfig = {
      ...defaultConfig,
      workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    };

    const batches: BatchToSchedule[] = [
      {
        id: 'b1',
        name: 'Violin Intro',
        days_of_week: ['Tue', 'Thu'],
        start_time: '15:00',
        end_time: '16:00',
      },
    ];

    const result = generateTimetableDraft(batches, configWithWeekends);

    expect(result.isValid).toBe(true);
    expect(result.stats.usedWeekend).toBe(false);
    expect(result.classes.every((c) => !c.is_weekend)).toBe(true);
  });

  it('uses weekend slots only when weekdays are full and weekend is enabled', () => {
    // Very tight weekday window (only 70 minutes per day, enough for 1 class of 60m)
    const tightConfigWithWeekend: WorkingHoursConfig = {
      workingDays: ['Mon', 'Sat'],
      weekdayWindow: { startTime: '14:00', endTime: '15:00' }, // only 1 hr
      weekendWindow: { startTime: '10:00', endTime: '18:00' },
      minBreakMinutes: 10,
      maxClassesPerDay: null,
    };

    const batches: BatchToSchedule[] = [
      {
        id: 'b1',
        name: 'Batch 1',
        days_of_week: ['Mon'],
        start_time: '14:00',
        end_time: '15:00',
      },
      {
        id: 'b2',
        name: 'Batch 2',
        days_of_week: ['Mon'], // Cannot fit on Mon because Mon is full
        start_time: '14:00',
        end_time: '15:00',
      },
    ];

    const result = generateTimetableDraft(batches, tightConfigWithWeekend);

    expect(result.isValid).toBe(true);
    expect(result.stats.usedWeekend).toBe(true);
    const satClasses = result.classes.filter((c) => c.day_of_week === 'Sat');
    expect(satClasses.length).toBe(1);
    expect(satClasses[0].batch_id).toBe('b2');
  });

  it('returns a clear reason for an impossible case', () => {
    // Mon only, 1 hr window. Two 1-hr classes cannot fit. Weekends disabled.
    const impossibleConfig: WorkingHoursConfig = {
      workingDays: ['Mon'],
      weekdayWindow: { startTime: '14:00', endTime: '15:00' },
      weekendWindow: { startTime: '10:00', endTime: '18:00' },
      minBreakMinutes: 10,
      maxClassesPerDay: null,
    };

    const batches: BatchToSchedule[] = [
      {
        id: 'b1',
        name: 'Batch 1',
        days_of_week: ['Mon'],
        start_time: '14:00',
        end_time: '15:00',
      },
      {
        id: 'b2',
        name: 'Batch 2',
        days_of_week: ['Mon'],
        start_time: '14:00',
        end_time: '15:00',
      },
    ];

    const result = generateTimetableDraft(batches, impossibleConfig);

    expect(result.isValid).toBe(false);
    expect(result.unplacedBatches.length).toBe(1);
    expect(result.unplacedBatches[0].batch_name).toBe('Batch 2');
    expect(result.unplacedBatches[0].reason).toContain('Weekday working window');
  });

  it('generates a 20-batch schedule in well under 2 seconds', () => {
    const largeBatchList: BatchToSchedule[] = Array.from({ length: 20 }, (_, i) => ({
      id: `batch-${i + 1}`,
      name: `Music Ensemble ${i + 1}`,
      days_of_week: i % 2 === 0 ? ['Mon', 'Wed'] : ['Tue', 'Thu'],
      start_time: `${14 + (i % 5)}:00`,
      end_time: `${15 + (i % 5)}:00`,
    }));

    const wideConfig: WorkingHoursConfig = {
      workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      weekdayWindow: { startTime: '10:00', endTime: '22:00' },
      weekendWindow: { startTime: '10:00', endTime: '18:00' },
      minBreakMinutes: 10,
      maxClassesPerDay: null,
    };

    const startTime = performance.now();
    const result = generateTimetableDraft(largeBatchList, wideConfig);
    const duration = performance.now() - startTime;

    // Must be well under 2000ms (typically < 15ms)
    expect(duration).toBeLessThan(2000);
    expect(result.classes.length).toBeGreaterThan(0);

    const validation = validateTimetable(result.classes, wideConfig);
    expect(validation.isValid).toBe(true);
  });
});
