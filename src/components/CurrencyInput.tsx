import React from 'react';

export interface CurrencyInputProps {
  id?: string;
  label?: string;
  value: number | string;
  onChange: (value: number) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  id,
  label,
  value,
  onChange,
  error,
  helperText,
  placeholder = '0',
  min = 0,
  max,
  disabled = false,
  required = false,
  className = '',
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    const num = rawVal === '' ? 0 : parseInt(rawVal, 10);
    onChange(num);
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative rounded-lg shadow-2xs">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
          <span className="text-slate-500 dark:text-slate-400 font-semibold text-sm">₹</span>
        </div>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value === 0 ? '' : value}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          min={min}
          max={max}
          className={`block w-full rounded-lg pl-8 pr-3.5 py-2.5 text-sm min-h-[44px] transition-colors
            bg-[var(--input-bg)] text-[var(--input-text)] placeholder-[var(--input-placeholder)] border-[var(--input-border)]
            ${
              error
                ? 'border-red-400 dark:border-red-600 focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500 text-red-900 dark:text-red-200'
                : 'hover:border-slate-400 dark:hover:border-slate-600 focus-visible:border-indigo-600 dark:focus-visible:border-indigo-400'
            }
            ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
          `}
        />
      </div>

      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
};
