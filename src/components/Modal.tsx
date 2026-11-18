import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Container: Fullscreen on mobile, centered modal dialog on tablet/desktop */}
      <div className="flex min-h-full items-stretch sm:items-center justify-center p-0 sm:p-6 text-center">
        <div
          className={`relative transform overflow-hidden rounded-none sm:rounded-2xl bg-white dark:bg-[#131c2e] text-left shadow-xl transition-all w-full h-full sm:h-auto min-h-screen sm:min-h-0 ${maxWidthStyles[maxWidth]} border-0 sm:border border-slate-200 dark:border-[#26324a] flex flex-col`}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 dark:border-[#26324a] shrink-0">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-[#f1f5f9]" id="modal-title">
                {title}
              </h3>
              {description && <p className="mt-1 text-xs text-slate-500 dark:text-[#a9b4c7]">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 -mr-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2540] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="px-5 sm:px-6 py-5 flex-1 overflow-y-auto max-h-[calc(100vh-80px)] sm:max-h-[calc(85vh-120px)] text-slate-800 dark:text-slate-200">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
