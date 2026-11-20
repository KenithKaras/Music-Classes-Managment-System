import { supabase } from '../lib/supabase';
import { buildStudentPhotoPath, extractStoragePath } from '../utils/studentPhotoUtils';

const BUCKET_NAME = 'student-photos';
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates file format and file size on the client before upload.
 */
export function validateStudentPhoto(file: File): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  // Check file size (max 2 MB)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size exceeds the 2 MB limit (Selected file is ${sizeInMb} MB). Please choose a smaller image.`,
    };
  }

  // Check MIME type and file extension
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type);
  const isExtensionValid = ALLOWED_EXTENSIONS.includes(extension);

  if (!isMimeValid && !isExtensionValid) {
    return {
      valid: false,
      error: 'Invalid file format. Only JPG, PNG, and WebP images are allowed.',
    };
  }

  return { valid: true };
}

/**
 * Uploads a student photo to the student-photos Supabase Storage bucket.
 * Returns the public CDN URL of the uploaded image.
 */
export async function uploadStudentPhoto(file: File): Promise<{ url: string | null; error: string | null }> {
  const validation = validateStudentPhoto(file);
  if (!validation.valid) {
    return { url: null, error: validation.error || 'Invalid file' };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { url: null, error: 'Unauthorized: You must be logged in to upload student photos.' };
    }

    const filePath = buildStudentPhotoPath(user.id, file.name);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      if (import.meta.env.DEV) {
        console.error('Error uploading photo to Supabase Storage:', uploadError);
      }
      return {
        url: null,
        error: uploadError.message || 'Failed to upload photo. Please verify the student-photos bucket exists.',
      };
    }

    return { url: filePath, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unexpected photo upload error';
    return { url: null, error: msg };
  }
}

/**
 * Deletes a student photo from the bucket if it exists.
 */
export async function deleteStudentPhoto(photoUrl: string): Promise<{ error: string | null }> {
  if (!photoUrl) {
    return { error: null };
  }

  try {
    const filePath = extractStoragePath(photoUrl, BUCKET_NAME);
    if (!filePath) return { error: null };

    const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

    if (error && import.meta.env.DEV) {
      console.warn('Failed to delete old photo from storage:', error);
    }

    return { error: error ? error.message : null };
  } catch {
    return { error: null };
  }
}
