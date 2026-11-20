import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildStudentPhotoPath,
  selectSubmissionsNeedingBackfill,
  hasSubmissionsNeedingBackfill,
  getInitials,
  extractStoragePath,
  clearSignedUrlCache,
} from './studentPhotoUtils';
import type { Student, EnrollmentSubmission } from '../types';

describe('studentPhotoUtils', () => {
  beforeEach(() => {
    clearSignedUrlCache();
  });

  describe('buildStudentPhotoPath (path builder)', () => {
    it('constructs path matching {userId}/students/{UUID}-{timestamp}.{ext}', () => {
      const userId = '11111111-2222-3333-4444-555555555555';
      const path = buildStudentPhotoPath(userId, 'photo.png');
      expect(path.startsWith(`${userId}/students/`)).toBe(true);
      expect(path.endsWith('.png')).toBe(true);
    });

    it('extracts extension correctly from full paths and filenames', () => {
      const userId = 'user-abc';
      expect(buildStudentPhotoPath(userId, 'uploads/avatar.jpeg').endsWith('.jpeg')).toBe(true);
      expect(buildStudentPhotoPath(userId, 'child.webp').endsWith('.webp')).toBe(true);
      expect(buildStudentPhotoPath(userId, 'noextension').endsWith('.jpg')).toBe(true);
    });

    it('supports custom filename when provided', () => {
      const path = buildStudentPhotoPath('user-1', 'png', 'fixed-avatar.png');
      expect(path).toBe('user-1/students/fixed-avatar.png');
    });
  });

  describe('selectSubmissionsNeedingBackfill (needs backfill selector)', () => {
    const mockStudents: Student[] = [
      {
        id: 'student-1',
        batch_id: 'batch-1',
        full_name: 'Aarav Patel',
        phone: '9876543210',
        email: null,
        address: null,
        status: 'active',
        enrollment_date: '2026-01-01',
        guardian_name: 'Raj Patel',
        guardian_phone: '9876543210',
        photo_url: null, // NO photo
        monthly_fee: 1500,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'student-2',
        batch_id: 'batch-1',
        full_name: 'Diya Sharma',
        phone: '9876543211',
        email: null,
        address: null,
        status: 'active',
        enrollment_date: '2026-01-01',
        guardian_name: 'Anil Sharma',
        guardian_phone: '9876543211',
        photo_url: 'user/students/existing.jpg', // ALREADY HAS PHOTO
        monthly_fee: 1500,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'student-3',
        batch_id: 'batch-1',
        full_name: 'Rohan Verma',
        phone: '9876543212',
        email: null,
        address: null,
        status: 'active',
        enrollment_date: '2026-01-01',
        guardian_name: 'Sunita Verma',
        guardian_phone: '9876543212',
        photo_url: null, // NO photo
        monthly_fee: 1500,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    const mockSubmissions: EnrollmentSubmission[] = [
      {
        id: 'sub-1',
        owner_id: 'owner-1',
        enrollment_link_id: 'link-1',
        child_name: 'Aarav Patel',
        parent_name: 'Raj Patel',
        parent_phone: '9876543210',
        parent_email: 'raj@example.com',
        address: '123 Music Lane',
        preferred_batch: 'Guitar',
        photo_path: 'enrollment-photos/photo-1.jpg',
        consent_at: '2026-01-01T00:00:00Z',
        status: 'approved',
        student_id: 'student-1',
        reviewed_at: '2026-01-02T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'sub-2',
        owner_id: 'owner-1',
        enrollment_link_id: 'link-2',
        child_name: 'Diya Sharma',
        parent_name: 'Anil Sharma',
        parent_phone: '9876543211',
        parent_email: 'anil@example.com',
        address: '456 Song St',
        preferred_batch: 'Vocals',
        photo_path: 'enrollment-photos/photo-2.jpg',
        consent_at: '2026-01-01T00:00:00Z',
        status: 'approved',
        student_id: 'student-2', // student-2 already has photo_url
        reviewed_at: '2026-01-02T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'sub-3',
        owner_id: 'owner-1',
        enrollment_link_id: 'link-3',
        child_name: 'Rohan Verma',
        parent_name: 'Sunita Verma',
        parent_phone: '9876543212',
        parent_email: 'sunita@example.com',
        address: '789 Rhythm Rd',
        preferred_batch: 'Keyboard',
        photo_path: 'enrollment-photos/photo-3.png',
        consent_at: '2026-01-01T00:00:00Z',
        status: 'approved',
        student_id: 'student-3',
        reviewed_at: '2026-01-02T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'sub-4-pending',
        owner_id: 'owner-1',
        enrollment_link_id: 'link-4',
        child_name: 'Pending Child',
        parent_name: 'Pending Parent',
        parent_phone: '9876543213',
        parent_email: 'pending@example.com',
        address: '101 Beat Blvd',
        preferred_batch: 'Drums',
        photo_path: 'enrollment-photos/photo-4.jpg',
        consent_at: '2026-01-01T00:00:00Z',
        status: 'pending', // NOT approved
        student_id: null,
        reviewed_at: null,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'sub-5-no-photo',
        owner_id: 'owner-1',
        enrollment_link_id: 'link-5',
        child_name: 'No Photo Child',
        parent_name: 'No Photo Parent',
        parent_phone: '9876543214',
        parent_email: 'nophoto@example.com',
        address: '102 Melody Ave',
        preferred_batch: 'Violin',
        photo_path: null, // NO photo_path
        consent_at: '2026-01-01T00:00:00Z',
        status: 'approved',
        student_id: 'student-1',
        reviewed_at: '2026-01-02T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    it('returns only approved submissions with photo_path whose student has no photo_url', () => {
      const candidates = selectSubmissionsNeedingBackfill(mockSubmissions, mockStudents);
      expect(candidates.length).toBe(2);
      expect(candidates.map((c) => c.student.id)).toEqual(['student-1', 'student-3']);
    });

    it('never overwrites an existing student photo_url', () => {
      const candidates = selectSubmissionsNeedingBackfill(mockSubmissions, mockStudents);
      const student2Candidate = candidates.find((c) => c.student.id === 'student-2');
      expect(student2Candidate).toBeUndefined();
    });

    it('returns false for hasSubmissionsNeedingBackfill when all students have photo_url or no approved submissions', () => {
      expect(hasSubmissionsNeedingBackfill(mockSubmissions, mockStudents)).toBe(true);

      const allPatchedStudents = mockStudents.map((s) => ({
        ...s,
        photo_url: 'user/students/photo.jpg',
      }));
      expect(hasSubmissionsNeedingBackfill(mockSubmissions, allPatchedStudents)).toBe(false);
      expect(selectSubmissionsNeedingBackfill(mockSubmissions, allPatchedStudents)).toEqual([]);
    });
  });

  describe('getInitials', () => {
    it('returns initials for two-word names', () => {
      expect(getInitials('Rohan Verma')).toBe('RV');
      expect(getInitials('Sunita Verma')).toBe('SV');
      expect(getInitials('Aarav Patel')).toBe('AP');
    });

    it('returns initials for multi-word names (first and last word)', () => {
      expect(getInitials('Mary Jane Watson')).toBe('MW');
    });

    it('returns up to 2 characters for single-word names', () => {
      expect(getInitials('Aarav')).toBe('AA');
      expect(getInitials('A')).toBe('A');
    });

    it('returns "?" for empty or missing names', () => {
      expect(getInitials('')).toBe('?');
      expect(getInitials('   ')).toBe('?');
      expect(getInitials(null)).toBe('?');
      expect(getInitials(undefined)).toBe('?');
    });
  });

  describe('extractStoragePath', () => {
    it('returns relative storage path unmodified', () => {
      expect(extractStoragePath('user-1/students/file.png')).toBe('user-1/students/file.png');
    });

    it('extracts path from full Supabase Storage CDN URL', () => {
      const url = 'https://xyz.supabase.co/storage/v1/object/public/student-photos/user-1/students/file.png';
      expect(extractStoragePath(url, 'student-photos')).toBe('user-1/students/file.png');
    });

    it('strips query parameters from URLs or paths', () => {
      const urlWithQuery = 'user-1/students/file.png?token=12345';
      expect(extractStoragePath(urlWithQuery)).toBe('user-1/students/file.png');
    });
  });
});
