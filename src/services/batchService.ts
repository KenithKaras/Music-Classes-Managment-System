import { supabase } from '../lib/supabase';
import type { Batch, BatchFormData, Student } from '../types';

export async function getBatches(): Promise<{ batches: Batch[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('batches')
      .select(`
        *,
        students:students(count)
      `)
      .order('name', { ascending: true });

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching batches:', error);
      }
      return { batches: [], error: error.message };
    }

    const mapped: Batch[] = (data || []).map((b) => {
      // PostgREST returns students: [{ count: 3 }]
      const count = Array.isArray(b.students) && b.students.length > 0 
        ? (b.students[0] as { count: number }).count 
        : 0;

      return {
        id: b.id,
        name: b.name,
        days_of_week: b.days_of_week || [],
        start_time: b.start_time,
        end_time: b.end_time,
        capacity: b.capacity,
        created_at: b.created_at,
        updated_at: b.updated_at,
        student_count: count,
      };
    });

    return { batches: mapped, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query batches';
    return { batches: [], error: msg };
  }
}

export async function getBatchById(
  id: string
): Promise<{ batch: Batch | null; students: Student[]; error: string | null }> {
  try {
    const { data: batchData, error: batchError } = await supabase
      .from('batches')
      .select('*')
      .eq('id', id)
      .single();

    if (batchError) {
      return { batch: null, students: [], error: batchError.message };
    }

    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('batch_id', id)
      .order('full_name', { ascending: true });

    if (studentsError) {
      return { batch: batchData as Batch, students: [], error: studentsError.message };
    }

    const batch: Batch = {
      ...(batchData as Batch),
      student_count: studentsData ? studentsData.length : 0,
    };

    return {
      batch,
      students: (studentsData || []) as Student[],
      error: null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get batch details';
    return { batch: null, students: [], error: msg };
  }
}

export async function createBatch(formData: BatchFormData): Promise<{ batch: Batch | null; error: string | null }> {
  try {
    const payload = {
      name: formData.name.trim(),
      days_of_week: formData.days_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      capacity: formData.capacity !== null && formData.capacity > 0 ? formData.capacity : null,
    };

    const { data, error } = await supabase
      .from('batches')
      .insert([payload])
      .select()
      .single();

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error creating batch:', error);
      }
      if (error.code === '23505') {
        return { batch: null, error: `A batch named "${formData.name.trim()}" already exists. Please choose a unique name.` };
      }
      return { batch: null, error: error.message };
    }

    return { batch: { ...(data as Batch), student_count: 0 }, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create batch';
    return { batch: null, error: msg };
  }
}

export async function updateBatch(
  id: string,
  formData: BatchFormData
): Promise<{ batch: Batch | null; error: string | null }> {
  try {
    const payload = {
      name: formData.name.trim(),
      days_of_week: formData.days_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      capacity: formData.capacity !== null && formData.capacity > 0 ? formData.capacity : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('batches')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating batch:', error);
      }
      if (error.code === '23505') {
        return { batch: null, error: `A batch named "${formData.name.trim()}" already exists. Please choose a unique name.` };
      }
      return { batch: null, error: error.message };
    }

    return { batch: data as Batch, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update batch';
    return { batch: null, error: msg };
  }
}

export async function deleteBatch(id: string): Promise<{ error: string | null }> {
  try {
    // Foreign key has on delete set null, but we explicitly clear batch_id just to be thorough
    await supabase.from('students').update({ batch_id: null }).eq('batch_id', id);

    const { error } = await supabase
      .from('batches')
      .delete()
      .eq('id', id);

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error deleting batch:', error);
      }
      return { error: error.message };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete batch';
    return { error: msg };
  }
}
