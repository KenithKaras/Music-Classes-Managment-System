import React, { useState, useEffect } from 'react';
import { getStudentPhotoSignedUrl, getInitials } from '../utils/studentPhotoUtils';

export type AvatarSize = 'sm' | 'md' | 'lg';

interface StudentAvatarProps {
  photoUrl?: string | null;
  name?: string | null;
  bucket?: 'student-photos' | 'enrollment-photos';
  size?: AvatarSize;
  className?: string;
  textClassName?: string;
}

const SIZE_CONFIG: Record<AvatarSize, { px: number; containerClass: string; textClass: string }> = {
  sm: {
    px: 40,
    containerClass: 'w-10 h-10',
    textClass: 'text-xs font-bold uppercase',
  },
  md: {
    px: 56,
    containerClass: 'w-14 h-14',
    textClass: 'text-base font-bold uppercase',
  },
  lg: {
    px: 96,
    containerClass: 'w-24 h-24',
    textClass: 'text-2xl font-bold uppercase',
  },
};

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  photoUrl,
  name,
  bucket,
  size = 'sm',
  className = '',
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
  const config = SIZE_CONFIG[size] || SIZE_CONFIG.sm;

  const sizeStyle: React.CSSProperties = {
    width: `${config.px}px`,
    height: `${config.px}px`,
    minWidth: `${config.px}px`,
    minHeight: `${config.px}px`,
    maxWidth: `${config.px}px`,
    maxHeight: `${config.px}px`,
  };

  // Fallback to initials avatar if no photoUrl, or failed signed URL
  if (!photoUrl || hasError || !signedUrl) {
    return (
      <div
        className={`${config.containerClass} ${className} rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 flex-none overflow-hidden select-none`}
        style={sizeStyle}
        aria-label={name || 'Student initials'}
      >
        <span className={textClassName || config.textClass}>
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${config.containerClass} ${className} rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-[#26324a] overflow-hidden flex items-center justify-center shrink-0 flex-none`}
      style={sizeStyle}
    >
      <img
        src={signedUrl}
        alt={name || 'Student photo'}
        className="w-full h-full object-cover rounded-full"
        style={{ width: '100%', height: '100%' }}
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
