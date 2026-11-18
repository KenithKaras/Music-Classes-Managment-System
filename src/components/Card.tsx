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
      className={`bg-white dark:bg-[#111a2b] border border-slate-200 dark:border-[#1f2a3d] rounded-2xl shadow-xs dark:shadow-soft-dark text-slate-900 dark:text-[#f1f5f9] ${
        hover ? 'hover:shadow-md dark:hover:border-indigo-800/80 transition-all' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
