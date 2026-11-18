import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Sparkles, ArrowRight, Settings, Users, Calendar } from 'lucide-react';
import { Button } from './Button';

interface OnboardingChecklistProps {
  hasProfileConfigured: boolean;
  hasBatches: boolean;
  hasStudents: boolean;
  onOpenWizard: () => void;
  className?: string;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  hasProfileConfigured,
  hasBatches,
  hasStudents,
  onOpenWizard,
  className = '',
}) => {
  const items = [
    {
      id: 'profile',
      label: 'Configure Academy Profile & Working Days',
      completed: hasProfileConfigured,
      action: onOpenWizard,
      buttonText: 'Setup Academy',
      icon: Settings,
    },
    {
      id: 'batch',
      label: 'Create your first Music Batch',
      completed: hasBatches,
      link: '/batches',
      buttonText: 'Add Batch',
      icon: Calendar,
    },
    {
      id: 'student',
      label: 'Enroll your first Student',
      completed: hasStudents,
      link: '/students',
      buttonText: 'Add Student',
      icon: Users,
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const isAllComplete = completedCount === items.length;

  if (isAllComplete) {
    return null;
  }

  const progressPercent = Math.round((completedCount / items.length) * 100);

  return (
    <div
      className={`bg-linear-to-r from-indigo-50/90 to-purple-50/70 dark:from-slate-900 dark:to-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-3xl p-5 sm:p-6 shadow-xs ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-100 dark:border-indigo-900/40">
        <div>
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Academy Quick Setup</span>
          </div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-1">
            Complete your academy setup ({completedCount}/{items.length} steps)
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Follow these 3 quick steps to unlock automated timetables and instant receipts.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onOpenWizard}
          icon={ArrowRight}
          className="shrink-0"
        >
          Open Setup Wizard
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 mb-5">
        <div className="w-full h-2 rounded-full bg-indigo-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                item.completed
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60'
                  : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {item.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p
                    className={`text-xs font-bold leading-tight ${
                      item.completed
                        ? 'text-emerald-900 dark:text-emerald-200 line-through opacity-80'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {item.label}
                  </p>
                </div>
              </div>

              {!item.completed && (
                <div className="pt-1">
                  {item.link ? (
                    <Link
                      to={item.link}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline min-h-[36px]"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.buttonText}</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={item.action}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline min-h-[36px]"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.buttonText}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
