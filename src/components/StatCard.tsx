import React from 'react';
import { Card } from './Card';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  iconBgColor?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-indigo-600 dark:text-indigo-400',
  iconBgColor = 'bg-indigo-50 dark:bg-indigo-950/70',
  trend,
  onClick,
  className = '',
}) => {
  return (
    <Card
      onClick={onClick}
      hover={Boolean(onClick)}
      className={`p-5 flex flex-col justify-between ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-[#a9b4c7] uppercase tracking-wider">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#f1f5f9] mt-1.5 tracking-tight">
            {value}
          </p>
        </div>

        {Icon && (
          <div className={`w-10 h-10 rounded-xl ${iconBgColor} flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/40`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-[#26324a] flex items-center justify-between text-xs text-slate-500 dark:text-[#a9b4c7]">
          {subtitle && <span>{subtitle}</span>}
          {trend && (
            <span
              className={`font-semibold ml-auto ${
                trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}
    </Card>
  );
};
