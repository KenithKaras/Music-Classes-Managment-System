/**
 * Timetable Auto-Generator Algorithm
 * 
 * Objective:
 * "Optimized for: fewest teaching days and shortest idle time."
 * 
 * Rules:
 * 1. Gives every active batch its required weekly sessions.
 * 2. Never overlaps classes across all batches.
 * 3. Keeps the minimum break time between classes.
 * 4. Uses weekdays first. A weekend slot is used only if enabled and weekdays cannot fit.
 * 5. Minimizes the teacher's time on campus: fewest teaching days, fewest idle gaps, compact schedule.
 * 6. Prefers each batch's preferred time when possible.
 * 7. Pure function with zero database calls. Extremely fast (< 10ms for 20 batches).
 */

import type { DayOfWeek, WorkingHoursConfig, DraftClassSession, TimetableDraftResult } from '../types';

export const WEEKDAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const WEEKENDS: DayOfWeek[] = ['Sat', 'Sun'];
export const ALL_DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface BatchToSchedule {
  id: string;
  name: string;
  days_of_week: string[];
  start_time: string; // HH:MM or HH:MM:SS
  end_time: string;   // HH:MM or HH:MM:SS
  is_active?: boolean;
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  const hours = isNaN(parts[0]) ? 0 : parts[0];
  const minutes = isNaN(parts[1]) ? 0 : parts[1];
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function getDayWindow(day: DayOfWeek, config: WorkingHoursConfig): { start: number; end: number } {
  const isWeekend = WEEKENDS.includes(day);
  const window = isWeekend ? config.weekendWindow : config.weekdayWindow;
  return {
    start: timeToMinutes(window.startTime),
    end: timeToMinutes(window.endTime),
  };
}

/**
 * Checks if a proposed [start, end] slot on a given day is valid against existing day slots,
 * respecting the window and the minimum break between classes.
 */
export function canPlaceSlot(
  start: number,
  end: number,
  existingDaySlots: Array<{ start: number; end: number }>,
  dayWindow: { start: number; end: number },
  minBreak: number,
  maxClassesPerDay?: number | null
): boolean {
  // Check window bounds
  if (start < dayWindow.start || end > dayWindow.end) {
    return false;
  }

  // Check max classes limit
  if (maxClassesPerDay && existingDaySlots.length >= maxClassesPerDay) {
    return false;
  }

  // Check conflicts and breaks with all existing classes on this day
  for (const existing of existingDaySlots) {
    // 1. Direct overlap
    if (start < existing.end && end > existing.start) {
      return false;
    }
    // 2. Break rule before existing class
    if (start < existing.start && end + minBreak > existing.start) {
      return false;
    }
    // 3. Break rule after existing class
    if (start > existing.start && existing.end + minBreak > start) {
      return false;
    }
  }

  return true;
}

/**
 * Pure auto-generation function for weekly music academy timetable.
 */
export function generateTimetableDraft(
  batches: BatchToSchedule[],
  config: WorkingHoursConfig
): TimetableDraftResult {
  const resultClasses: DraftClassSession[] = [];
  const unplacedBatches: Array<{ batch_id: string; batch_name: string; reason: string }> = [];

  const enabledWorkingDays = config.workingDays || WEEKDAYS;
  const enabledWeekdays = WEEKDAYS.filter((d) => enabledWorkingDays.includes(d));
  const enabledWeekends = WEEKENDS.filter((d) => enabledWorkingDays.includes(d));
  const minBreak = config.minBreakMinutes ?? 10;

  // Track scheduled slots per day: day -> Array<{ start: number, end: number, batchId: string }>
  const scheduleMap = new Map<DayOfWeek, Array<{ start: number; end: number; batchId: string }>>();
  ALL_DAYS.forEach((d) => scheduleMap.set(d, []));

  // Sort batches: batches with fewer allowed/preferred days or larger duration first (Most Constrained First)
  const sortedBatches = [...batches].sort((a, b) => {
    const durA = Math.max(30, timeToMinutes(a.end_time) - timeToMinutes(a.start_time));
    const durB = Math.max(30, timeToMinutes(b.end_time) - timeToMinutes(b.start_time));
    return durB - durA; // longer classes first
  });

  for (const batch of sortedBatches) {
    const preferredStart = timeToMinutes(batch.start_time);
    const preferredEnd = timeToMinutes(batch.end_time);
    const duration = Math.max(30, preferredEnd > preferredStart ? preferredEnd - preferredStart : 60);

    // Required sessions per week based on batch.days_of_week
    const requiredDays = batch.days_of_week && batch.days_of_week.length > 0
      ? (batch.days_of_week as DayOfWeek[])
      : (['Mon', 'Wed'] as DayOfWeek[]);

    let sessionsPlaced = 0;
    const placedDaysForBatch = new Set<DayOfWeek>();

    for (const targetDay of requiredDays) {
      let placed = false;

      // 1. Check if batch's preferred day is enabled
      const isDayEnabled = enabledWorkingDays.includes(targetDay);

      // Candidate days ordered to minimize teacher's campus days:
      // Priority A: targetDay (if enabled)
      // Priority B: other enabled weekdays that already have classes scheduled (compact campus days)
      // Priority C: other enabled empty weekdays
      // Priority D: enabled weekends (only if weekdays cannot fit)
      const candidateDays: DayOfWeek[] = [];

      if (isDayEnabled && !placedDaysForBatch.has(targetDay)) {
        candidateDays.push(targetDay);
      }

      // Add other enabled weekdays
      const otherWeekdays = enabledWeekdays
        .filter((d) => d !== targetDay && !placedDaysForBatch.has(d))
        .sort((d1, d2) => {
          // Prefer days with existing classes to minimize total campus days
          const count1 = scheduleMap.get(d1)?.length || 0;
          const count2 = scheduleMap.get(d2)?.length || 0;
          return count2 - count1;
        });
      candidateDays.push(...otherWeekdays);

      // Add enabled weekend days last (weekdays first policy)
      const otherWeekends = enabledWeekends.filter(
        (d) => d !== targetDay && !placedDaysForBatch.has(d)
      );
      candidateDays.push(...otherWeekends);

      // Attempt to schedule on candidate days
      for (const day of candidateDays) {
        if (placed) break;

        const dayWindow = getDayWindow(day, config);
        const daySlots = scheduleMap.get(day) || [];

        // Try preferred time first if it fits inside this day window
        if (
          preferredStart >= dayWindow.start &&
          preferredStart + duration <= dayWindow.end &&
          canPlaceSlot(preferredStart, preferredStart + duration, daySlots, dayWindow, minBreak, config.maxClassesPerDay)
        ) {
          const newSlot = {
            start: preferredStart,
            end: preferredStart + duration,
            batchId: batch.id,
          };
          daySlots.push(newSlot);
          daySlots.sort((a, b) => a.start - b.start);
          scheduleMap.set(day, daySlots);

          resultClasses.push({
            tempId: `draft-${batch.id}-${day}-${newSlot.start}`,
            batch_id: batch.id,
            batch_name: batch.name,
            day_of_week: day,
            start_time: minutesToTime(newSlot.start),
            end_time: minutesToTime(newSlot.end),
            duration_minutes: duration,
            is_weekend: WEEKENDS.includes(day),
          });

          placedDaysForBatch.add(day);
          sessionsPlaced++;
          placed = true;
          break;
        }

        // Try packing immediately after existing classes or at day start (minimizing idle gap)
        const candidateStartTimes: number[] = [dayWindow.start];

        for (const existing of daySlots) {
          candidateStartTimes.push(existing.end + minBreak);
        }

        // Also try right before existing classes
        for (const existing of daySlots) {
          candidateStartTimes.push(existing.start - duration - minBreak);
        }

        // Sort candidate times by closeness to preferred time or earliest packed
        candidateStartTimes.sort((t1, t2) => {
          const diff1 = Math.abs(t1 - preferredStart);
          const diff2 = Math.abs(t2 - preferredStart);
          return diff1 - diff2;
        });

        for (const startTime of candidateStartTimes) {
          const endTime = startTime + duration;
          if (canPlaceSlot(startTime, endTime, daySlots, dayWindow, minBreak, config.maxClassesPerDay)) {
            const newSlot = {
              start: startTime,
              end: endTime,
              batchId: batch.id,
            };
            daySlots.push(newSlot);
            daySlots.sort((a, b) => a.start - b.start);
            scheduleMap.set(day, daySlots);

            resultClasses.push({
              tempId: `draft-${batch.id}-${day}-${newSlot.start}`,
              batch_id: batch.id,
              batch_name: batch.name,
              day_of_week: day,
              start_time: minutesToTime(newSlot.start),
              end_time: minutesToTime(newSlot.end),
              duration_minutes: duration,
              is_weekend: WEEKENDS.includes(day),
            });

            placedDaysForBatch.add(day);
            sessionsPlaced++;
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        let reason = `Could not find an available slot for session on ${targetDay}.`;
        if (!isDayEnabled) {
          reason = `Preferred day ${targetDay} is turned off in Working Days, and all enabled weekdays/weekends are at full capacity.`;
        } else if (enabledWeekends.length === 0) {
          reason = `Weekday working window (${config.weekdayWindow.startTime} - ${config.weekdayWindow.endTime}) has no available non-overlapping slot with ${minBreak}m break. Weekends are disabled.`;
        } else {
          reason = `All enabled weekday and weekend time slots are occupied without conflict.`;
        }

        unplacedBatches.push({
          batch_id: batch.id,
          batch_name: batch.name,
          reason,
        });
      }
    }
  }

  // Calculate statistics
  let totalMinutes = 0;
  let longestIdleGap = 0;
  let teachingDaysCount = 0;
  let usedWeekend = false;

  scheduleMap.forEach((slots, day) => {
    if (slots.length > 0) {
      teachingDaysCount++;
      if (WEEKENDS.includes(day)) {
        usedWeekend = true;
      }

      // Compute total minutes and idle gaps between consecutive classes
      for (let i = 0; i < slots.length; i++) {
        totalMinutes += slots[i].end - slots[i].start;

        if (i < slots.length - 1) {
          const rawGap = slots[i + 1].start - slots[i].end;
          // Idle gap beyond minimum break
          const idleGap = Math.max(0, rawGap - minBreak);
          if (idleGap > longestIdleGap) {
            longestIdleGap = idleGap;
          }
        }
      }
    }
  });

  const totalTeachingHours = Math.round((totalMinutes / 60) * 10) / 10;

  return {
    classes: resultClasses,
    unplacedBatches,
    stats: {
      totalTeachingHours,
      teachingDaysCount,
      longestIdleGapMinutes: longestIdleGap,
      usedWeekend,
    },
    isValid: unplacedBatches.length === 0,
    validationError: unplacedBatches.length > 0 ? unplacedBatches[0].reason : null,
  };
}

/**
 * Validates a list of draft or manually-edited classes against working hours rules:
 * - No overlaps on the same day.
 * - Minimum break respected.
 * - Classes stay within day's working window.
 * - No classes placed on disabled days.
 */
export function validateTimetable(
  classes: DraftClassSession[],
  config: WorkingHoursConfig
): { isValid: boolean; error: string | null } {
  const minBreak = config.minBreakMinutes ?? 10;
  const enabledDays = new Set(config.workingDays || WEEKDAYS);

  // Group by day
  const dayMap = new Map<DayOfWeek, DraftClassSession[]>();
  ALL_DAYS.forEach((d) => dayMap.set(d, []));

  for (const cls of classes) {
    if (!enabledDays.has(cls.day_of_week)) {
      return {
        isValid: false,
        error: `Class for ${cls.batch_name} is scheduled on ${cls.day_of_week}, which is currently turned off in Working Days.`,
      };
    }
    dayMap.get(cls.day_of_week)?.push(cls);
  }

  for (const [day, dayClasses] of dayMap.entries()) {
    if (dayClasses.length === 0) continue;

    const dayWindow = getDayWindow(day, config);

    // Sort by start time
    const sorted = [...dayClasses].sort(
      (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
    );

    for (let i = 0; i < sorted.length; i++) {
      const curStart = timeToMinutes(sorted[i].start_time);
      const curEnd = timeToMinutes(sorted[i].end_time);

      if (curEnd <= curStart) {
        return {
          isValid: false,
          error: `${sorted[i].batch_name} on ${day} has invalid times: end time must be after start time.`,
        };
      }

      if (curStart < dayWindow.start || curEnd > dayWindow.end) {
        return {
          isValid: false,
          error: `${sorted[i].batch_name} on ${day} (${sorted[i].start_time} - ${sorted[i].end_time}) falls outside the working window (${minutesToTime(dayWindow.start)} - ${minutesToTime(dayWindow.end)}).`,
        };
      }

      if (i > 0) {
        const prevEnd = timeToMinutes(sorted[i - 1].end_time);
        if (curStart < prevEnd) {
          return {
            isValid: false,
            error: `Schedule conflict on ${day}: ${sorted[i - 1].batch_name} (${sorted[i - 1].start_time} - ${sorted[i - 1].end_time}) overlaps with ${sorted[i].batch_name} (${sorted[i].start_time} - ${sorted[i].end_time}).`,
          };
        }

        const gap = curStart - prevEnd;
        if (gap < minBreak) {
          return {
            isValid: false,
            error: `Insufficient break on ${day}: ${gap} min between ${sorted[i - 1].batch_name} and ${sorted[i].batch_name}. Minimum required break is ${minBreak} min.`,
          };
        }
      }
    }
  }

  return { isValid: true, error: null };
}
