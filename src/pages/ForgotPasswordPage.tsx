import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Music2, Mail, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { ThemeToggle } from '../components/ThemeToggle';

export const ForgotPasswordPage: React.FC = () => {
  const { resetPasswordForEmail, isConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    if (!email.trim()) {
      setFieldError('Email address is required.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordForEmail(email);
    } finally {
      setLoading(false);
      // Always show generic message to prevent account enumeration
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-[#f1f5f9] flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4 transition-colors">
      {/* Top Bar Navigation */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-[#a9b4c7] hover:text-indigo-600 dark:hover:text-[#f1f5f9] transition-colors p-2 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to home</span>
        </Link>
      </div>

      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="sm:mx-auto sm:w-full sm:max-w-md text-center"
      >
        <Link
          to="/"
          aria-label="Go to home"
          className="inline-flex items-center gap-2.5 group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shadow-sm">
            <Music2 className="w-5 h-5" />
          </div>
          <span className="font-bold text-slate-900 dark:text-[#f1f5f9] text-xl tracking-tight">
            MIX with Me Classes
          </span>
        </Link>
        <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-[#f1f5f9]">
          Reset your password
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-[#a9b4c7]">
          Enter your email to receive recovery instructions
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mt-6 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white dark:bg-[#131c2e] py-7 px-6 shadow-sm border border-slate-200 dark:border-[#26324a] rounded-2xl sm:px-8">
          {submitted ? (
            <div className="text-center py-2 space-y-4">
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#f1f5f9]">
                Check Your Email
              </h2>
              <p className="text-sm text-slate-600 dark:text-[#a9b4c7] leading-relaxed">
                If an account exists for this email, we&apos;ve sent a reset link.
              </p>
              <p className="text-xs text-slate-500 dark:text-[#a9b4c7]">
                Please check your inbox and spam folder. Click the link inside to set a new password.
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-[#26324a] bg-white dark:bg-[#1a2540] text-slate-700 dark:text-[#f1f5f9] hover:bg-slate-50 dark:hover:bg-[#131c2e] font-medium text-sm transition-colors min-h-[44px]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold text-slate-700 dark:text-[#a9b4c7] mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-[#a9b4c7]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldError) setFieldError(null);
                    }}
                    className={`block w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm border bg-white dark:bg-[#1a2540] text-slate-900 dark:text-[#f1f5f9] placeholder-slate-400 dark:placeholder-slate-500 transition-colors min-h-[44px] ${
                      fieldError
                        ? 'border-rose-400 dark:border-rose-600 focus-visible:border-rose-500'
                        : 'border-slate-300 dark:border-[#26324a] hover:border-slate-400 dark:hover:border-slate-500 focus-visible:border-indigo-600 dark:focus-visible:border-indigo-400'
                    }`}
                    placeholder="teacher@example.com"
                    disabled={loading}
                  />
                </div>
                {fieldError && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldError}</p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center min-h-[44px]"
                  loading={loading}
                  disabled={!isConfigured || loading}
                >
                  Send Recovery Link
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#26324a] text-center">
            <Link
              to="/login"
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center min-h-[44px]"
            >
              Remember your password? Sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
