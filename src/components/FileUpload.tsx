import React, { useRef, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { Button } from './Button';
import { compressImage } from '../utils/imageCompressor';

export interface FileUploadProps {
  label?: string;
  accept?: string;
  maxSizeBytes?: number;
  previewUrl?: string | null;
  onFileSelect: (file: File) => void;
  onClear?: () => void;
  error?: string;
  helperText?: string;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  accept = 'image/jpeg,image/png,image/webp',
  maxSizeBytes = 2 * 1024 * 1024, // 2 MB default
  previewUrl,
  onFileSelect,
  onClear,
  error,
  helperText,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const handleFile = async (file: File) => {
    setLocalError(null);

    // Client-side image compression before upload
    let processedFile = file;
    if (file.type.startsWith('image/')) {
      try {
        setCompressing(true);
        processedFile = await compressImage(file, 1200, 0.85);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('Image compression bypassed:', err);
        }
      } finally {
        setCompressing(false);
      }
    }

    // Validate size
    if (processedFile.size > maxSizeBytes) {
      setLocalError(`File size must be under ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`);
      return;
    }

    onFileSelect(processedFile);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>
      )}

      {previewUrl ? (
        <div className="relative rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] p-4 flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl overflow-hidden border border-[var(--input-border)] bg-[var(--surface)] flex items-center justify-center shrink-0">
            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Current Academy Logo</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Preview shown on invoices &amp; receipts.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                Change Logo
              </Button>
              {onClear && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                  disabled={disabled}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                  icon={X}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !disabled && !compressing && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-[var(--input-border)] hover:border-slate-400 dark:hover:border-slate-600 bg-[var(--input-bg)]'
          } ${disabled || compressing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-600 dark:text-slate-300 mb-2">
            <UploadCloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {compressing ? 'Optimizing image...' : 'Click to upload or drag and drop'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            PNG, JPG, or WebP up to 2 MB
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />

      {(error || localError) && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error || localError}</p>
      )}
      {!error && !localError && helperText && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      )}
    </div>
  );
};
