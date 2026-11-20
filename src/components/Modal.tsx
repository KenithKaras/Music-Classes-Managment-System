import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
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
      document.body.classList.add('modal-open');
      document.body.setAttribute('data-modal-open', 'true');
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      const remainingModals = document.querySelectorAll('[role="dialog"]');
      if (remainingModals.length <= 1) {
        document.body.style.overflow = 'unset';
        document.body.classList.remove('modal-open');
        document.body.removeAttribute('data-modal-open');
      }
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
    <div
      className="fixed inset-0 z-50 overflow-hidden sm:overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Container: Fullscreen fixed sheet on mobile, centered modal dialog on tablet/desktop */}
      <div className="fixed inset-0 sm:static flex flex-col sm:flex-row sm:min-h-full items-stretch sm:items-center justify-center p-0 sm:p-6 text-center z-10 pointer-events-none">
        <div
          className={`relative transform overflow-hidden rounded-none sm:rounded-2xl bg-white dark:bg-[#131c2e] text-left shadow-xl transition-all w-full h-full sm:h-auto sm:max-h-[85vh] ${maxWidthStyles[maxWidth]} border-0 sm:border border-slate-200 dark:border-[#26324a] flex flex-col min-h-0 pointer-events-auto`}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white dark:bg-[#131c2e] flex items-start justify-between px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 dark:border-[#26324a] shrink-0">
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
          <div className="px-5 sm:px-6 py-5 flex-1 overflow-y-auto overflow-x-hidden min-h-0 text-slate-800 dark:text-slate-200 flex flex-col">
            {children}
          </div>

          {/* Optional Footer */}
          {footer && (
            <div className="sticky bottom-0 z-10 bg-white dark:bg-[#131c2e] px-5 sm:px-6 py-3 sm:py-4 border-t border-slate-100 dark:border-[#26324a] shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
