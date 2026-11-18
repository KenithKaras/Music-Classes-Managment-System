import React from 'react';

export interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
}) => {
  const variantClass =
    variant === 'circular'
      ? 'rounded-full'
      : variant === 'text'
      ? 'rounded-md h-4 my-1'
      : 'rounded-xl';

  return (
    <div
      style={{ width, height }}
      className={`animate-pulse bg-slate-200 dark:bg-slate-800 ${variantClass} ${className}`}
      aria-hidden="true"
    />
  );
};
