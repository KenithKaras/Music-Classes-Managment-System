import { supabase } from '../lib/supabase';
import type {
  AttendanceRecord,
  AttendanceStatus,
  StudentMonthlyAttendance,
  ConsecutiveAbsenceStudent,
  Student,
} from '../types';
import {
  calculateAttendancePercentage,
  calculateConsecutiveAbsences,
  isNeedsAttention,
} from '../utils/attendanceUtils';

/**
 * Saves attendance for all students in a class at once using upsert.
 */
export async function saveClassAttendance(
  classId: string,
  records: Array<{ studentId: string; status: AttendanceStatus }>
): Promise<{ error: string | null }> {
  try {
    if (records.length === 0) {
      return { error: 'No attendance records to save.' };
    }

    // Verify class status first
    const { data: classData, error: classErr } = await supabase
      .from('classes')
      .select('id, status, batch_id')
      .eq('id', classId)
      .single();

    if (classErr) return { error: classErr.message };
    if (classData.status === 'cancelled') {
      return { error: 'Attendance cannot be marked for a cancelled class.' };
    }

    const payload = records.map((r) => ({
      class_id: classId,
      student_id: r.studentId,
      status: r.status,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertErr } = await supabase
      .from('attendance')
      .upsert(payload, { onConflict: 'class_id,student_id' });

    if (upsertErr) {
      if (import.meta.env.DEV) console.error('Error saving attendance:', upsertErr);
      return { error: upsertErr.message };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save attendance';
    return { error: msg };
  }
}

/**
 * Saves or clears attendance for an individual student (tapped button).
 * If status is null, deletes the attendance record.
 */
export async function updateStudentAttendance(
  classId: string,
  studentId: string,
  status: AttendanceStatus | null
): Promise<{ error: string | null }> {
  try {
    if (status === null) {
      const { error: delErr } = await supabase
        .from('attendance')
        .delete()
        .eq('class_id', classId)
        .eq('student_id', studentId);

      if (delErr) {
        if (import.meta.env.DEV) console.error('Error clearing attendance:', delErr);
        return { error: delErr.message };
      }
      return { error: null };
    }

    const { error: upsertErr } = await supabase
      .from('attendance')
      .upsert(
        {
          class_id: classId,
          student_id: studentId,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'class_id,student_id' }
      );

    if (upsertErr) {
      if (import.meta.env.DEV) console.error('Error saving attendance:', upsertErr);
      return { error: upsertErr.message };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update attendance';
    return { error: msg };
  }
}

/**
 * Marks all given active students as 'present' for a class session.
 */
export async function markAllStudentsPresent(
  classId: string,
  studentIds: string[]
): Promise<{ error: string | null }> {
  try {
    if (studentIds.length === 0) return { error: null };

    const payload = studentIds.map((studentId) => ({
      class_id: classId,
      student_id: studentId,
      status: 'present' as AttendanceStatus,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertErr } = await supabase
      .from('attendance')
      .upsert(payload, { onConflict: 'class_id,student_id' });

    if (upsertErr) {
      if (import.meta.env.DEV) console.error('Error marking all present:', upsertErr);
      return { error: upsertErr.message };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to mark all present';
    return { error: msg };
  }
}

/**
 * Fetches existing attendance records for a specific class session.
 */
export async function getClassAttendanceRecords(
  classId: string
): Promise<{ records: AttendanceRecord[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        student:students (
          id,
          full_name,
          photo_url,
          phone
        )
      `)
      .eq('class_id', classId);

    if (error) {
      return { records: [], error: error.message };
    }

    return { records: (data || []) as AttendanceRecord[], error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get attendance records';
    return { records: [], error: msg };
  }
}

export interface StudentAttendanceDraft {
  student: Student;
  status: AttendanceStatus | null; // null if unmarked
  marked_at?: string | null;
  updated_at?: string | null;
}

/**
 * Retrieves the batch students for a class along with any already marked attendance status.
 */
export async function getStudentsForClassAttendance(
  classId: string
): Promise<{
  students: StudentAttendanceDraft[];
  className: string;
  classDate: string;
  batchId: string;
  error: string | null;
}> {
  try {
    // 1. Fetch class details
    const { data: classData, error: classErr } = await supabase
      .from('classes')
      .select(`
        id,
        class_date,
        batch_id,
        status,
        batch:batches (
          id,
          name
        )
      `)
      .eq('id', classId)
      .single();

    if (classErr) {
      return {
        students: [],
        className: '',
        classDate: '',
        batchId: '',
        error: classErr.message,
      };
    }

    const batchObj = Array.isArray(classData.batch) 
      ? (classData.batch[0] as { id: string; name: string } | undefined) 
      : (classData.batch as { id: string; name: string } | null);
    const batchName = batchObj?.name || 'Class Session';

    if (classData.status === 'cancelled') {
      return {
        students: [],
        className: batchName,
        classDate: classData.class_date,
        batchId: classData.batch_id,
        error: 'Attendance cannot be marked for cancelled classes.',
      };
    }

    // 2. Fetch active students in this batch enrolled on or before the class date
    const { data: studentsData, error: studErr } = await supabase
      .from('students')
      .select('*')
      .eq('batch_id', classData.batch_id)
      .eq('status', 'active')
      .lte('enrollment_date', classData.class_date)
      .order('full_name', { ascending: true });

    if (studErr) {
      return {
        students: [],
        className: batchName,
        classDate: classData.class_date,
        batchId: classData.batch_id,
        error: studErr.message,
      };
    }

    // 3. Fetch existing attendance for this class
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('student_id, status, marked_at, updated_at')
      .eq('class_id', classId);

    const existingMap = new Map<
      string,
      { status: AttendanceStatus; marked_at: string | null; updated_at: string | null }
    >();
    for (const att of existingAttendance || []) {
      existingMap.set(att.student_id, {
        status: att.status as AttendanceStatus,
        marked_at: att.marked_at || null,
        updated_at: att.updated_at || null,
      });
    }

    const merged: StudentAttendanceDraft[] = (studentsData || []).map((student) => {
      const existing = existingMap.get(student.id);
      return {
        student: student as Student,
        status: existing ? existing.status : null,
        marked_at: existing ? existing.marked_at : null,
        updated_at: existing ? existing.updated_at : null,
      };
    });

    return {
      students: merged,
      className: batchName,
      classDate: classData.class_date,
      batchId: classData.batch_id,
      error: null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load students for class attendance';
    return {
      students: [],
      className: '',
      classDate: '',
      batchId: '',
      error: msg,
    };
  }
}

/**
 * Computes monthly attendance report for a chosen batch and month (1-12).
 */
export async function getMonthlyAttendanceReport(
  batchId: string,
  year: number,
  month: number
): Promise<{
  report: StudentMonthlyAttendance[];
  totalBatchClasses: number;
  error: string | null;
}> {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    // Last day of month
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // 1. Get all non-cancelled classes for this batch in that month
    const { data: classes, error: classErr } = await supabase
      .from('classes')
      .select('id, class_date')
      .eq('batch_id', batchId)
      .eq('status', 'scheduled')
      .gte('class_date', startDate)
      .lte('class_date', endDate);

    if (classErr) return { report: [], totalBatchClasses: 0, error: classErr.message };

    const classIds = (classes || []).map((c) => c.id);
    const totalBatchClasses = classIds.length;

    // 2. Fetch all students currently enrolled in this batch
    const { data: students, error: studErr } = await supabase
      .from('students')
      .select('id, full_name, photo_url')
      .eq('batch_id', batchId)
      .order('full_name', { ascending: true });

    if (studErr) return { report: [], totalBatchClasses: 0, error: studErr.message };

    if (classIds.length === 0 || !students || students.length === 0) {
      const emptyReport: StudentMonthlyAttendance[] = (students || []).map((s) => ({
        student_id: s.id,
        student_name: s.full_name,
        photo_url: s.photo_url,
        present_count: 0,
        absent_count: 0,
        total_classes: 0,
        percentage: 0,
      }));
      return { report: emptyReport, totalBatchClasses: 0, error: null };
    }

    // 3. Fetch attendance records for these classes
    const { data: attendanceData, error: attErr } = await supabase
      .from('attendance')
      .select('student_id, status')
      .in('class_id', classIds);

    if (attErr) return { report: [], totalBatchClasses, error: attErr.message };

    const studentCounts: { [id: string]: { present: number; absent: number } } = {};
    for (const att of attendanceData || []) {
      if (!studentCounts[att.student_id]) {
        studentCounts[att.student_id] = { present: 0, absent: 0 };
      }
      if (att.status === 'present') studentCounts[att.student_id].present++;
      else if (att.status === 'absent') studentCounts[att.student_id].absent++;
    }

    const report: StudentMonthlyAttendance[] = students.map((s) => {
      const counts = studentCounts[s.id] || { present: 0, absent: 0 };
      const recordedTotal = counts.present + counts.absent;
      const percentage = calculateAttendancePercentage(counts.present, recordedTotal);

      return {
        student_id: s.id,
        student_name: s.full_name,
        photo_url: s.photo_url,
        present_count: counts.present,
        absent_count: counts.absent,
        total_classes: recordedTotal,
        percentage,
      };
    });

    return { report, totalBatchClasses, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate monthly attendance report';
    return { report: [], totalBatchClasses: 0, error: msg };
  }
}

/**
 * Calculates overall attendance stats for an individual student (for the Student Profile page).
 */
export async function getStudentAttendanceSummary(
  studentId: string
): Promise<{
  present: number;
  absent: number;
  total: number;
  percentage: number;
  recentHistory: Array<{ date: string; status: AttendanceStatus; batchName?: string }>;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        status,
        marked_at,
        class:classes (
          class_date,
          batch:batches (
            name
          )
        )
      `)
      .eq('student_id', studentId)
      .order('marked_at', { ascending: false });

    if (error) {
      return { present: 0, absent: 0, total: 0, percentage: 0, recentHistory: [], error: error.message };
    }

    let present = 0;
    let absent = 0;
    const recentHistory: Array<{ date: string; status: AttendanceStatus; batchName?: string }> = [];

    for (const record of data || []) {
      if (record.status === 'present') present++;
      if (record.status === 'absent') absent++;

      const classObj = record.class as unknown as { class_date: string; batch?: { name: string } };
      if (classObj) {
        recentHistory.push({
          date: classObj.class_date,
          status: record.status as AttendanceStatus,
          batchName: classObj.batch?.name,
        });
      }
    }

    const total = present + absent;
    const percentage = calculateAttendancePercentage(present, total);

    return {
      present,
      absent,
      total,
      percentage,
      recentHistory: recentHistory.slice(0, 5), // last 5 sessions
      error: null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch student attendance summary';
    return { present: 0, absent: 0, total: 0, percentage: 0, recentHistory: [], error: msg };
  }
}

/**
 * Finds students with 3 or more consecutive recorded absences in their assigned batch.
 * Shown in the "Needs attention" list on the Dashboard and Attendance page.
 */
export async function getNeedsAttentionStudents(): Promise<{
  students: ConsecutiveAbsenceStudent[];
  error: string | null;
}> {
  try {
    // 1. Fetch active students with batches
    const { data: students, error: studErr } = await supabase
      .from('students')
      .select(`
        id,
        full_name,
        photo_url,
        phone,
        batch_id,
        batch:batches (
          id,
          name
        )
      `)
      .eq('status', 'active')
      .not('batch_id', 'is', null);

    if (studErr) {
      return { students: [], error: studErr.message };
    }

    if (!students || students.length === 0) {
      return { students: [], error: null };
    }

    const needsAttentionList: ConsecutiveAbsenceStudent[] = [];

    // 2. For each student, check their recorded attendance in their batch
    for (const s of students) {
      const { data: records, error: recErr } = await supabase
        .from('attendance')
        .select(`
          status,
          class:classes!inner (
            class_date,
            batch_id
          )
        `)
        .eq('student_id', s.id)
        .eq('class.batch_id', s.batch_id)
        .order('class(class_date)', { ascending: false })
        .limit(10);

      if (recErr || !records || records.length === 0) {
        continue;
      }

      const history = records.map((r) => ({
        status: r.status as 'present' | 'absent',
      }));

      const consecutiveAbsences = calculateConsecutiveAbsences(history);

      if (isNeedsAttention(consecutiveAbsences, 3)) {
        const lastClass = records[0].class as unknown as { class_date: string };
        needsAttentionList.push({
          student_id: s.id,
          student_name: s.full_name,
          photo_url: s.photo_url,
          phone: s.phone,
          batch_id: s.batch_id as string,
          batch_name: (s.batch as unknown as { name: string })?.name || 'Class Batch',
          consecutive_absences: consecutiveAbsences,
          last_absence_date: lastClass?.class_date || 'Recent',
        });
      }
    }

    return { students: needsAttentionList, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query attendance flags';
    return { students: [], error: msg };
  }
}

/**
 * Returns today's attendance summary (present count and absent count) for the dashboard.
 */
export async function getTodayAttendanceSummary(): Promise<{
  presentCount: number;
  absentCount: number;
  totalClasses: number;
  markedClasses: number;
  error: string | null;
}> {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Fetch classes for today
    const { data: todayClasses, error: classErr } = await supabase
      .from('classes')
      .select('id, status')
      .eq('class_date', todayStr);

    if (classErr) {
      return { presentCount: 0, absentCount: 0, totalClasses: 0, markedClasses: 0, error: classErr.message };
    }

    const nonCancelled = (todayClasses || []).filter((c) => c.status !== 'cancelled');
    if (nonCancelled.length === 0) {
      return { presentCount: 0, absentCount: 0, totalClasses: 0, markedClasses: 0, error: null };
    }

    const classIds = nonCancelled.map((c) => c.id);

    const { data: records, error: recErr } = await supabase
      .from('attendance')
      .select('class_id, status')
      .in('class_id', classIds);

    if (recErr) {
      return { presentCount: 0, absentCount: 0, totalClasses: nonCancelled.length, markedClasses: 0, error: recErr.message };
    }

    let presentCount = 0;
    let absentCount = 0;
    const markedClassSet = new Set<string>();

    for (const r of records || []) {
      if (r.status === 'present') presentCount++;
      if (r.status === 'absent') absentCount++;
      markedClassSet.add(r.class_id);
    }

    return {
      presentCount,
      absentCount,
      totalClasses: nonCancelled.length,
      markedClasses: markedClassSet.size,
      error: null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch today attendance summary';
    return { presentCount: 0, absentCount: 0, totalClasses: 0, markedClasses: 0, error: msg };
  }
}
