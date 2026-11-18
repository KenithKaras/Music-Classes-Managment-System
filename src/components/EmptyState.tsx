import React from 'react';
import { Button } from './Button';
import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  actionIcon,
}) => {
  return (
    <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 dark:border-[#26324a] bg-white dark:bg-[#131c2e]">
      <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 dark:bg-[#1a2540] flex items-center justify-center text-slate-500 dark:text-[#a9b4c7] mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-[#f1f5f9]">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-[#a9b4c7] max-w-sm mx-auto">{description}</p>
      {actionText && onAction && (
        <div className="mt-5">
          <Button type="button" onClick={onAction} icon={actionIcon} size="md">
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
};
