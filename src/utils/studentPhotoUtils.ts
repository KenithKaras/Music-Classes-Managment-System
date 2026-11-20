import { supabase } from '../lib/supabase';
import type { Student, EnrollmentSubmission } from '../types';

/**
 * In-memory cache for signed URLs to honor 60-second lifetime without redundant storage API calls.
 * Key: `${bucket}:${path}` -> { url: string, expiresAt: number }
 */
export const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Clears the in-memory signed URL cache (useful for tests).
 */
export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}

/**
 * Extracts student initials (up to 2 characters uppercase).
 * e.g. "Rohan Verma" -> "RV", "Aarav" -> "AA", "" -> "?"
 */
export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Builds the storage path for a student photo in the student-photos bucket.
 * Multi-tenant path format: `${userId}/students/${UUID}-${timestamp}.${ext}`
 */
export function buildStudentPhotoPath(
  userId: string,
  filenameOrExt: string,
  customFileName?: string
): string {
  if (customFileName) {
    return `${userId}/students/${customFileName}`;
  }
  let cleanExt = 'jpg';
  if (filenameOrExt.includes('.')) {
    cleanExt = filenameOrExt.split('.').pop()?.toLowerCase() || 'jpg';
  } else {
    const raw = filenameOrExt.trim().replace(/^\./, '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp'].includes(raw)) {
      cleanExt = raw;
    }
  }
  const fileName = `${crypto.randomUUID()}-${Date.now()}.${cleanExt}`;
  return `${userId}/students/${fileName}`;
}

/**
 * Extracts the relative bucket storage path from a path or full URL.
 * e.g. "https://.../student-photos/user/students/abc.png" -> "user/students/abc.png"
 * e.g. "user/students/abc.png" -> "user/students/abc.png"
 */
export function extractStoragePath(pathOrUrl: string, bucket = 'student-photos'): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.includes(`${bucket}/`)) {
    const after = pathOrUrl.split(`${bucket}/`)[1];
    return after.split('?')[0];
  }
  return pathOrUrl.replace(/^\/+/, '').split('?')[0];
}

/**
 * Fetches a 60-second signed URL for a photo in student-photos (or enrollment-photos).
 * Caches in memory for its lifetime (~55s) to prevent redundant requests.
 */
export async function getStudentPhotoSignedUrl(
  photoPathOrUrl: string,
  preferredBucket?: 'student-photos' | 'enrollment-photos',
  expiresIn = 60
): Promise<string | null> {
  if (!photoPathOrUrl) return null;

  // Blob or data URLs don't need signing
  if (photoPathOrUrl.startsWith('blob:') || photoPathOrUrl.startsWith('data:')) {
    return photoPathOrUrl;
  }

  const bucket: 'student-photos' | 'enrollment-photos' =
    preferredBucket ||
    (photoPathOrUrl.includes('enrollment-photos') ? 'enrollment-photos' : 'student-photos');

  const storagePath = extractStoragePath(photoPathOrUrl, bucket);
  if (!storagePath) return null;

  const cacheKey = `${bucket}:${storagePath}`;
  const now = Date.now();
  const cached = signedUrlCache.get(cacheKey);

  if (cached && now < cached.expiresAt) {
    return cached.url;
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresIn);

    if (error || !data?.signedUrl) {
      if (import.meta.env.DEV) {
        console.error(`Failed to create signed URL from ${bucket}:`, error);
      }
      return null;
    }

    // Cache with a 5-second buffer before true expiration
    const ttlMs = Math.max((expiresIn - 5) * 1000, 1000);
    signedUrlCache.set(cacheKey, { url: data.signedUrl, expiresAt: now + ttlMs });
    return data.signedUrl;
  } catch (err: unknown) {
    if (import.meta.env.DEV) {
      console.error(`Unexpected error creating signed URL from ${bucket}:`, err);
    }
    return null;
  }
}

/**
 * Backfill Candidate interface
 */
export interface BackfillCandidate {
  submission: EnrollmentSubmission;
  student: Student;
}

/**
 * Pure selector: returns submissions that need photo backfill.
 * Criteria:
 * 1. Submission status is 'approved'
 * 2. Submission has photo_path
 * 3. Submission has student_id
 * 4. Corresponding student exists in students list
 * 5. Corresponding student has NO photo_url (never overwrite existing student photo_url)
 */
export function selectSubmissionsNeedingBackfill(
  submissions: EnrollmentSubmission[],
  students: Student[]
): BackfillCandidate[] {
  if (!submissions || !students) return [];

  const studentMap = new Map<string, Student>();
  for (const st of students) {
    studentMap.set(st.id, st);
  }

  const candidates: BackfillCandidate[] = [];
  for (const sub of submissions) {
    if (sub.status !== 'approved' || !sub.photo_path || !sub.student_id) {
      continue;
    }
    const student = studentMap.get(sub.student_id);
    // Student must exist and have no photo_url (do not overwrite)
    if (student && !student.photo_url) {
      candidates.push({ submission: sub, student });
    }
  }

  return candidates;
}

/**
 * Helper to check if any submissions need backfill.
 */
export function hasSubmissionsNeedingBackfill(
  submissions: EnrollmentSubmission[],
  students: Student[]
): boolean {
  return selectSubmissionsNeedingBackfill(submissions, students).length > 0;
}

/**
 * Copies a photo from enrollment-photos bucket to student-photos bucket using owner's session.
 * Reuses existing student photo upload path format and directly uploads downloaded Blob.
 */
export async function copyEnrollmentPhotoToStudentPhotos(
  photoPath: string
): Promise<{ path: string | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { path: null, error: 'Unauthorized: Owner session required.' };
    }

    const cleanPath = extractStoragePath(photoPath, 'enrollment-photos');

    // 1. Download file from enrollment-photos using owner's session
    const { data: blob, error: downloadError } = await supabase.storage
      .from('enrollment-photos')
      .download(cleanPath);

    if (downloadError || !blob) {
      if (import.meta.env.DEV) {
        console.error('Error downloading enrollment photo:', downloadError);
      }
      return { path: null, error: downloadError?.message || 'Could not copy the photo. Try again.' };
    }

    // 2. Build student-photos path using standard path format
    const newPath = buildStudentPhotoPath(user.id, photoPath);

    // 3. Upload Blob directly to student-photos bucket
    const { error: uploadError } = await supabase.storage
      .from('student-photos')
      .upload(newPath, blob, {
        contentType: blob.type || 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      if (import.meta.env.DEV) {
        console.error('Error uploading copied photo to student-photos:', uploadError);
      }
      return { path: null, error: uploadError.message || 'Could not copy the photo. Try again.' };
    }

    return { path: newPath, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Could not copy the photo. Try again.';
    return { path: null, error: msg };
  }
}
