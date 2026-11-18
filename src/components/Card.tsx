import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hover = false,
  ...props
}) => {
  return (
    <div
      className={`bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] rounded-2xl shadow-xs text-slate-900 dark:text-[#f1f5f9] ${
        hover ? 'hover:border-indigo-500/40 dark:hover:border-indigo-400/40 transition-colors' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
