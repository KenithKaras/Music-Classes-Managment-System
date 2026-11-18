import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Music2, Mail, ArrowRight, CheckCircle2, ArrowLeft } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4 transition-colors">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="sm:mx-auto sm:w-full sm:max-w-md text-center"
      >
        <Link
          to="/"
          aria-label="Go to home"
          className="inline-flex items-center gap-2.5 group"
        >
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
            <Music2 className="w-6 h-6" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-xl tracking-tight">
            MIX with Me Classes
          </span>
        </Link>
        <h1 className="mt-5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Reset your password
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          Enter your email to receive recovery instructions
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mt-7 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white dark:bg-[#111a2b] py-8 px-6 shadow-xl shadow-slate-200/50 dark:shadow-soft-dark border border-slate-200 dark:border-[#1f2a3d] rounded-3xl sm:px-10">
          {submitted ? (
            <div className="text-center py-2 space-y-4">
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Check Your Email
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                If an account exists for this email, we&apos;ve sent a reset link.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Please check your inbox and spam folder. Click the link inside to set a new password.
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-sm transition-colors min-h-[44px]"
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
                  htmlFor="reset-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Account Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldError) setFieldError(null);
                    }}
                    className={`block w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm border bg-white dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 transition-colors min-h-[44px] ${
                      fieldError
                        ? 'border-rose-400 dark:border-rose-600 focus-visible:border-rose-500'
                        : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 focus-visible:border-indigo-600 dark:focus-visible:border-indigo-400'
                    }`}
                    placeholder="teacher@example.com"
                    disabled={loading}
                    required
                  />
                </div>
                {fieldError && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldError}</p>}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center min-h-[44px]"
                  loading={loading}
                  disabled={!isConfigured || loading}
                  icon={ArrowRight}
                >
                  Send Reset Link
                </Button>
              </div>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5 min-h-[44px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
