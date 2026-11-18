import { supabase } from '../lib/supabase';
import type { Student, StudentFormData } from '../types';
import { deleteStudentPhoto } from './storageService';

export interface StudentFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  batchId?: string | 'all' | 'no-batch';
  page?: number;
  pageSize?: number;
}

export async function getStudents(
  filters?: StudentFilters
): Promise<{ students: Student[]; totalCount: number; error: string | null }> {
  try {
    let query = supabase
      .from('students')
      .select(`
        *,
        batch:batches (
          id,
          name,
          days_of_week,
          start_time,
          end_time
        )
      `, { count: 'exact' })
      .order('full_name', { ascending: true });

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters?.batchId && filters.batchId !== 'all') {
      if (filters.batchId === 'no-batch') {
        query = query.is('batch_id', null);
      } else {
        query = query.eq('batch_id', filters.batchId);
      }
    }

    if (filters?.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`full_name.ilike.${term},phone.ilike.${term}`);
    }

    const page = filters?.page;
    const pageSize = filters?.pageSize || 25;
    if (page && page > 0) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const { data, count, error } = await query;

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching students:', error);
      }
      return { students: [], totalCount: 0, error: error.message };
    }

    return {
      students: (data || []) as Student[],
      totalCount: count ?? (data?.length || 0),
      error: null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query students';
    return { students: [], totalCount: 0, error: msg };
  }
}

export async function getStudentById(
  id: string
): Promise<{ student: Student | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('students')
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
      if (import.meta.env.DEV) {
        console.error('Error fetching student by id:', error);
      }
      return { student: null, error: error.message };
    }

    return { student: data as Student, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get student';
    return { student: null, error: msg };
  }
}

export async function createStudent(
  formData: StudentFormData
): Promise<{ student: Student | null; error: string | null }> {
  try {
    const payload = {
      full_name: formData.full_name.trim(),
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      photo_url: formData.photo_url || null,
      guardian_name: formData.guardian_name.trim() || null,
      guardian_phone: formData.guardian_phone.trim() || null,
      address: formData.address.trim() || null,
      enrollment_date: formData.enrollment_date || new Date().toISOString().split('T')[0],
      batch_id: formData.batch_id || null,
      status: formData.status || 'active',
      monthly_fee: Number(formData.monthly_fee) >= 0 ? Number(formData.monthly_fee) : 0,
    };

    const { data, error } = await supabase
      .from('students')
      .insert([payload])
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
      if (import.meta.env.DEV) {
        console.error('Error creating student:', error);
      }
      return { student: null, error: error.message };
    }

    return { student: data as Student, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create student';
    return { student: null, error: msg };
  }
}

export async function updateStudent(
  id: string,
  formData: StudentFormData
): Promise<{ student: Student | null; error: string | null }> {
  try {
    const payload = {
      full_name: formData.full_name.trim(),
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      photo_url: formData.photo_url || null,
      guardian_name: formData.guardian_name.trim() || null,
      guardian_phone: formData.guardian_phone.trim() || null,
      address: formData.address.trim() || null,
      enrollment_date: formData.enrollment_date,
      batch_id: formData.batch_id || null,
      status: formData.status,
      monthly_fee: Number(formData.monthly_fee) >= 0 ? Number(formData.monthly_fee) : 0,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('students')
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
      if (import.meta.env.DEV) {
        console.error('Error updating student:', error);
      }
      return { student: null, error: error.message };
    }

    return { student: data as Student, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update student';
    return { student: null, error: msg };
  }
}

export async function deleteStudent(
  id: string,
  photoUrl?: string | null
): Promise<{ error: string | null }> {
  try {
    // If student has an avatar, delete it from storage
    if (photoUrl) {
      await deleteStudentPhoto(photoUrl);
    }

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error deleting student:', error);
      }
      return { error: error.message };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete student';
    return { error: msg };
  }
}

export async function transferStudentBatch(
  studentId: string,
  newBatchId: string | null
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('students')
      .update({
        batch_id: newBatchId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', studentId);

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error transferring student batch:', error);
      }
      return { error: error.message };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to transfer batch';
    return { error: msg };
  }
}

export async function getStudentCounts(): Promise<{
  total: number;
  active: number;
  inactive: number;
  error: string | null;
}> {
  try {
    const [totalRes, activeRes, inactiveRes] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'inactive'),
    ]);

    if (totalRes.error) throw totalRes.error;

    return {
      total: totalRes.count || 0,
      active: activeRes.count || 0,
      inactive: inactiveRes.count || 0,
      error: null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get student counts';
    return { total: 0, active: 0, inactive: 0, error: msg };
  }
}

export async function getRecentStudents(limit = 5): Promise<{ students: Student[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('students')
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
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { students: [], error: error.message };
    }

    return { students: (data || []) as Student[], error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch recent students';
    return { students: [], error: msg };
  }
}

export async function getStudentsWithoutBatch(): Promise<{ students: Student[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .is('batch_id', null)
      .eq('status', 'active')
      .order('full_name', { ascending: true });

    if (error) {
      return { students: [], error: error.message };
    }

    return { students: (data || []) as Student[], error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch unassigned students';
    return { students: [], error: msg };
  }
}
