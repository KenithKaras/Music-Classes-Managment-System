import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || props.name || Math.random().toString(36).substring(2, 9);

    return (
      <div className="w-full min-w-0">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative rounded-lg shadow-2xs">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`block w-full rounded-lg border text-sm min-h-[44px] transition-colors
              bg-[var(--input-bg)] text-[var(--input-text)] placeholder-[var(--input-placeholder)]
              ${leftIcon ? 'pl-10' : 'pl-3.5'} ${rightIcon ? 'pr-10' : 'pr-3.5'} py-2.5
              ${
                error
                  ? 'border-red-400 dark:border-red-600 focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500 text-red-900 dark:text-red-200'
                  : 'border-[var(--input-border)] hover:border-slate-400 dark:hover:border-slate-600 focus-visible:border-indigo-600 dark:focus-visible:border-indigo-400'
              }
              disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 dark:text-slate-500">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
