import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none min-h-[44px]';

  const sizeStyles = {
    sm: 'text-xs px-3 py-2 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-5 py-3 gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 shadow-xs border border-transparent',
    secondary:
      'bg-white dark:bg-[#131c2e] text-slate-700 dark:text-[#f1f5f9] hover:bg-slate-50 dark:hover:bg-[#1a2540] border border-slate-300 dark:border-[#26324a] shadow-2xs',
    danger:
      'bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-600 shadow-xs border border-transparent',
    ghost:
      'bg-transparent text-slate-700 dark:text-[#a9b4c7] hover:bg-slate-100 dark:hover:bg-[#1a2540] hover:text-slate-900 dark:hover:text-[#f1f5f9] border border-transparent',
    outline:
      'bg-transparent text-slate-900 dark:text-[#f1f5f9] hover:bg-slate-100 dark:hover:bg-[#1a2540] border border-slate-300 dark:border-[#26324a]',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : (
        icon && (
          <span className="shrink-0 flex items-center justify-center">
            {React.isValidElement(icon)
              ? icon
              : React.createElement(icon as React.ComponentType<{ className?: string }>, {
                  className: size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4',
                })}
          </span>
        )
      )}
      <span>{children}</span>
    </button>
  );
};
