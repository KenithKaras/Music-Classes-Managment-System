import React, { useState, useEffect } from 'react';
import { getStudentPhotoSignedUrl, getInitials } from '../utils/studentPhotoUtils';

interface StudentAvatarProps {
  photoUrl?: string | null;
  name?: string | null;
  bucket?: 'student-photos' | 'enrollment-photos';
  className?: string;
  textClassName?: string;
}

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  photoUrl,
  name,
  bucket,
  className = 'w-10 h-10',
  textClassName,
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;

    if (!photoUrl) {
      setSignedUrl(null);
      setHasError(false);
      return;
    }

    // Direct object URL (from file picker) or data URL
    if (photoUrl.startsWith('blob:') || photoUrl.startsWith('data:')) {
      setSignedUrl(photoUrl);
      setHasError(false);
      return;
    }

    getStudentPhotoSignedUrl(photoUrl, bucket)
      .then((url) => {
        if (!active) return;
        if (url) {
          setSignedUrl(url);
          setHasError(false);
        } else {
          setHasError(true);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (import.meta.env.DEV) {
          console.error('Error fetching 60-second signed URL for student photo:', err);
        }
        setHasError(true);
      });

    return () => {
      active = false;
    };
  }, [photoUrl, bucket]);

  const initials = getInitials(name);

  // Fallback to initials avatar if no photoUrl, or failed signed URL
  if (!photoUrl || hasError || !signedUrl) {
    return (
      <div
        className={`${className} rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 overflow-hidden select-none`}
        aria-label={name || 'Student initials'}
      >
        <span className={textClassName || 'text-xs font-bold uppercase'}>
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-[#26324a] overflow-hidden flex items-center justify-center shrink-0`}
    >
      <img
        src={signedUrl}
        alt={name || 'Student photo'}
        className="w-full h-full object-cover"
        onError={() => {
          if (import.meta.env.DEV) {
            console.error('Failed to load student photo from signed URL:', signedUrl);
          }
          setHasError(true);
        }}
      />
    </div>
  );
};
