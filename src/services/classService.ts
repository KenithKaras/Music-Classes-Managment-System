import { supabase } from '../lib/supabase';
import type { ClassSession, RescheduleClassFormData, DraftClassSession, DayOfWeek } from '../types';
import { getDayOfWeek } from '../utils/attendanceUtils';

/**
 * Attaches attendance summary counts (present/absent) to a list of class sessions.
 */
async function attachAttendanceSummaries(
  classes: ClassSession[]
): Promise<{ classes: ClassSession[]; error: string | null }> {
  if (classes.length === 0) {
    return { classes: [], error: null };
  }

  try {
    const classIds = classes.map((c) => c.id);
    const { data: records, error } = await supabase
      .from('attendance')
      .select('class_id, status')
      .in('class_id', classIds);

    if (error) {
      if (import.meta.env.DEV) console.error('Error fetching attendance summaries:', error);
      return { classes, error: null };
    }

    const summaryMap: { [classId: string]: { present: number; absent: number; total: number } } = {};

    for (const r of records || []) {
      if (!summaryMap[r.class_id]) {
        summaryMap[r.class_id] = { present: 0, absent: 0, total: 0 };
      }
      if (r.status === 'present') {
        summaryMap[r.class_id].present++;
      } else if (r.status === 'absent') {
        summaryMap[r.class_id].absent++;
      }
      summaryMap[r.class_id].total++;
    }

    const enriched = classes.map((c) => {
      const summary = summaryMap[c.id];
      return {
        ...c,
        attendance_summary: {
          present: summary?.present ?? 0,
          absent: summary?.absent ?? 0,
          total: summary?.total ?? 0,
          marked: Boolean(summary && summary.total > 0),
        },
      };
    });

    return { classes: enriched, error: null };
  } catch {
    return { classes, error: null };
  }
}

/**
 * Fetches saved class sessions for a specific date range (read-only, does NOT auto-insert).
 */
export async function getClassesForRange(
  startDate: string,
  endDate: string,
  batchFilter?: string
): Promise<{ classes: ClassSession[]; error: string | null }> {
  try {
    let query = supabase
      .from('classes')
      .select(`
        *,
        batch:batches (
          id,
          name,
          days_of_week,
          start_time,
          end_time
        )
      `)
      .gte('class_date', startDate)
      .lte('class_date', endDate)
      .order('class_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (batchFilter && batchFilter !== 'all') {
      query = query.eq('batch_id', batchFilter);
    }

    const { data, error } = await query;
    if (error) {
      return { classes: [], error: error.message };
    }

    return attachAttendanceSummaries((data || []) as ClassSession[]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query classes';
    return { classes: [], error: msg };
  }
}

// Backwards-compatible alias for existing callers
export const getOrGenerateClassesForRange = getClassesForRange;

/**
 * Saves a weekly timetable draft into the database for the active week.
 * 
 * Rules:
 * 1. Checks which existing classes in the range already have attendance marked.
 * 2. Never deletes or overwrites classes that have attendance marked.
 * 3. Deletes unmarked existing classes in that range.
 * 4. Inserts the draft class rows matching their day_of_week in the target date range.
 */
export async function saveTimetableDraft(
  startDate: string,
  endDate: string,
  draftClasses: DraftClassSession[]
): Promise<{
  success: boolean;
  createdCount: number;
  preservedClasses: ClassSession[];
  error: string | null;
}> {
  try {
    // 1. Fetch existing classes with attendance in range
    const { classes: existing, error: fetchErr } = await getClassesForRange(startDate, endDate);
    if (fetchErr) {
      return { success: false, createdCount: 0, preservedClasses: [], error: fetchErr };
    }

    const preservedClasses = existing.filter((c) => c.attendance_summary?.marked);
    const unpreservedClasses = existing.filter((c) => !c.attendance_summary?.marked);

    // 2. Delete unpreserved classes in this week
    if (unpreservedClasses.length > 0) {
      const idsToDelete = unpreservedClasses.map((c) => c.id);
      const { error: delErr } = await supabase.from('classes').delete().in('id', idsToDelete);
      if (delErr) {
        return { success: false, createdCount: 0, preservedClasses, error: delErr.message };
      }
    }

    // 3. Map day_of_week to exact calendar dates in [startDate, endDate]
    const dayToDateMap: { [day in DayOfWeek]?: string } = {};
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dayNum}`;
      const dayName = getDayOfWeek(dateStr);
      dayToDateMap[dayName] = dateStr;
    }

    // 4. Prepare new rows to insert
    const rowsToInsert: Array<{
      batch_id: string;
      class_date: string;
      start_time: string;
      end_time: string;
      status: 'scheduled';
    }> = [];

    const existingPreservedKeys = new Set(
      preservedClasses.map((c) => `${c.batch_id}_${c.class_date}_${c.start_time}`)
    );

    for (const draft of draftClasses) {
      const targetDate = dayToDateMap[draft.day_of_week];
      if (!targetDate) continue;

      const key = `${draft.batch_id}_${targetDate}_${draft.start_time}`;
      if (existingPreservedKeys.has(key)) {
        // Skip duplicate of already preserved class
        continue;
      }

      rowsToInsert.push({
        batch_id: draft.batch_id,
        class_date: targetDate,
        start_time: draft.start_time,
        end_time: draft.end_time,
        status: 'scheduled',
      });
    }

    if (rowsToInsert.length > 0) {
      const { error: insertErr } = await supabase.from('classes').insert(rowsToInsert);
      if (insertErr) {
        return { success: false, createdCount: 0, preservedClasses, error: insertErr.message };
      }
    }

    return {
      success: true,
      createdCount: rowsToInsert.length,
      preservedClasses,
      error: null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save timetable';
    return { success: false, createdCount: 0, preservedClasses: [], error: msg };
  }
}

/**
 * Gets a single class session by ID with its batch details.
 */
export async function getClassById(
  id: string
): Promise<{ classSession: ClassSession | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        batch:batches (
          id,
          name,
          days_of_week,
          start_time,
          end_time
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      return { classSession: null, error: error.message };
    }

    const [withAttendance] = (await attachAttendanceSummaries([data as ClassSession])).classes;
    return { classSession: withAttendance || (data as ClassSession), error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get class';
    return { classSession: null, error: msg };
  }
}

/**
 * Reschedules or edits an individual class (changing date, start time, end time, or batch).
 */
export async function rescheduleClass(
  id: string,
  formData: RescheduleClassFormData
): Promise<{ classSession: ClassSession | null; error: string | null }> {
  try {
    if (formData.start_time >= formData.end_time) {
      return { classSession: null, error: 'End time must be after start time.' };
    }

    const payload: {
      class_date: string;
      start_time: string;
      end_time: string;
      batch_id?: string;
      updated_at: string;
    } = {
      class_date: formData.class_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      updated_at: new Date().toISOString(),
    };

    if (formData.batch_id) {
      payload.batch_id = formData.batch_id;
    }

    const { data, error } = await supabase
      .from('classes')
      .update(payload)
      .eq('id', id)
      .select(`
        *,
        batch:batches (
          id,
          name,
          days_of_week,
          start_time,
          end_time
        )
      `)
      .single();

    if (error) {
      if (error.message.includes('Schedule conflict') || error.code === '23P01') {
        return {
          classSession: null,
          error: error.message || 'Schedule conflict: This timing overlaps with another scheduled class.',
        };
      }
      return { classSession: null, error: error.message };
    }

    return { classSession: data as ClassSession, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reschedule class';
    return { classSession: null, error: msg };
  }
}

/**
 * Cancels a class with an optional reason.
 */
export async function cancelClass(
  id: string,
  cancelReason?: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('classes')
      .update({
        status: 'cancelled',
        cancel_reason: cancelReason?.trim() || 'Cancelled by teacher',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to cancel class';
    return { error: msg };
  }
}

/**
 * Restores a previously cancelled class back to scheduled status.
 */
export async function restoreClass(id: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('classes')
      .update({
        status: 'scheduled',
        cancel_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      if (error.message.includes('Schedule conflict') || error.code === '23P01') {
        return { error: error.message || 'Cannot restore: Timings overlap with another active class.' };
      }
      return { error: error.message };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to restore class';
    return { error: msg };
  }
}

/**
 * Fetches today's classes with attendance summary for the dashboard.
 */
export async function getTodayClasses(): Promise<{
  classes: ClassSession[];
  error: string | null;
}> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  return getClassesForRange(todayStr, todayStr);
}
