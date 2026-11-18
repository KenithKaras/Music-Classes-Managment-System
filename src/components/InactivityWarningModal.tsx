import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from './Button';

export const InactivityWarningModal: React.FC = () => {
  const { inactivityWarning, dismissInactivityWarning, signOut } = useAuth();
  const [secondsRemaining, setSecondsRemaining] = useState(60);

  useEffect(() => {
    if (!inactivityWarning) {
      setSecondsRemaining(60);
      return;
    }

    setSecondsRemaining(60);
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [inactivityWarning]);

  if (!inactivityWarning) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-warning-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#111A2B] border border-amber-300 dark:border-amber-700/60 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 id="inactivity-warning-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Inactivity Warning
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your session is about to expire
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          For your academy&apos;s security, you will be automatically logged out in{' '}
          <strong className="text-amber-600 dark:text-amber-400 font-mono text-base font-bold">
            {secondsRemaining}s
          </strong>{' '}
          due to inactivity.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={dismissInactivityWarning}
            className="w-full justify-center min-h-[44px]"
          >
            Stay Logged In
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => signOut()}
            className="w-full sm:w-auto justify-center min-h-[44px]"
          >
            Log Out Now
          </Button>
        </div>
      </div>
    </div>
  );
};
