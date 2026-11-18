import React from 'react';
import { NavLink } from 'react-router-dom';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  badge?: string | number;
  to?: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  const renderIcon = (icon?: React.ReactNode | React.ComponentType<{ className?: string }>) => {
    if (!icon) return null;
    return (
      <span className="shrink-0 flex items-center justify-center">
        {React.isValidElement(icon)
          ? icon
          : React.createElement(icon as React.ComponentType<{ className?: string }>, {
              className: 'w-4 h-4',
            })}
      </span>
    );
  };

  const renderBadge = (badge: string | number | undefined, isActive: boolean) => {
    if (badge === undefined || badge === null) return null;
    return (
      <span
        className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
          isActive
            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        }`}
      >
        {badge}
      </span>
    );
  };

  return (
    <div className={`relative w-full border-b border-slate-200 dark:border-[#26324a] ${className}`}>
      {/* Mobile Right Edge Gradient Fade (no scrollbar arrow buttons) */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-[#0f172a] to-transparent sm:hidden z-10"
        aria-hidden="true"
      />

      <nav
        className="scrollbar-none -mb-px flex flex-nowrap sm:flex-wrap items-center overflow-x-auto gap-1 sm:gap-2 pr-6 sm:pr-0"
        aria-label="Tabs"
      >
        {tabs.map((tab) => {
          if (tab.to) {
            return (
              <NavLink
                key={tab.id || tab.to}
                to={tab.to}
                end
                className={({ isActive }) =>
                  `whitespace-nowrap px-3 sm:px-4 py-2.5 border-b-2 text-sm font-medium flex items-center gap-2 transition-colors min-h-[44px] shrink-0 rounded-t-lg ${
                    isActive
                      ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50/40 dark:bg-indigo-950/20'
                      : 'border-transparent text-slate-500 dark:text-[#a9b4c7] hover:text-slate-800 dark:hover:text-[#f1f5f9] hover:border-slate-300 dark:hover:border-[#26324a]'
                  }`
                }
              >
                {renderIcon(tab.icon)}
                <span>{tab.label}</span>
                {renderBadge(tab.badge, false)}
              </NavLink>
            );
          }

          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange && onChange(tab.id)}
              className={`whitespace-nowrap px-3 sm:px-4 py-2.5 border-b-2 text-sm font-medium flex items-center gap-2 transition-colors min-h-[44px] shrink-0 rounded-t-lg ${
                isActive
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50/40 dark:bg-indigo-950/20'
                  : 'border-transparent text-slate-500 dark:text-[#a9b4c7] hover:text-slate-800 dark:hover:text-[#f1f5f9] hover:border-slate-300 dark:hover:border-[#26324a]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {renderIcon(tab.icon)}
              <span>{tab.label}</span>
              {renderBadge(tab.badge, isActive)}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
