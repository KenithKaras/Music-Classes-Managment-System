import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={`p-2 rounded-xl border border-slate-200 dark:border-[#26324a] bg-white dark:bg-[#131c2e] text-slate-600 dark:text-[#a9b4c7] hover:text-slate-900 dark:hover:text-[#f1f5f9] hover:bg-slate-50 dark:hover:bg-[#1a2540] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${className}`}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-amber-400" />
      ) : (
        <Moon className="w-5 h-5 text-slate-600" />
      )}
    </button>
  );
};
