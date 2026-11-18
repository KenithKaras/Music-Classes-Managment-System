import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Music2, Lock, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { ThemeToggle } from '../components/ThemeToggle';
import { validatePasswordStrength } from '../utils/authUtils';
import { supabase } from '../lib/supabase';

export const ResetPasswordPage: React.FC = () => {
  const { updatePassword, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isVerifying, setIsVerifying] = useState(true);
  const [isLinkValid, setIsLinkValid] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check URL parameters and hash for Supabase error notifications (e.g. otp_expired)
    const hash = window.location.hash;
    const search = window.location.search;
    const fullParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : search);

    const hasError = fullParams.get('error') || fullParams.get('error_code');
    const errorDescription = fullParams.get('error_description');

    if (hasError) {
      setIsLinkValid(false);
      setError(
        errorDescription?.toLowerCase().includes('expired')
          ? 'This password reset link has expired. Please request a new one.'
          : 'This password reset link is invalid or has already been used.'
      );
      setIsVerifying(false);
      return;
    }

    // Verify recovery session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsLinkValid(true);
        } else {
          // If no immediate session, give onAuthStateChange a moment to detect hash token
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' || session) {
              setIsLinkValid(true);
              setIsVerifying(false);
            }
          });

          // Timeout after 3 seconds if no recovery session recognized
          setTimeout(() => {
            setIsVerifying((prev) => {
              if (prev) {
                // If still verifying and no session, treat as invalid/expired
                supabase.auth.getSession().then(({ data }) => {
                  if (!data.session) {
                    setIsLinkValid(false);
                    setError('This password reset link has expired or is invalid.');
                  }
                });
              }
              return false;
            });
            subscription.unsubscribe();
          }, 3000);
          return;
        }
      } catch {
        setIsLinkValid(false);
        setError('Unable to verify reset link. Please request a new one.');
      } finally {
        setIsVerifying(false);
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const strengthCheck = validatePasswordStrength(password);
    if (!strengthCheck.isValid) {
      setError(strengthCheck.error);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updatePassword(password);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        // Automatically redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } finally {
      setIsSubmitting(false);
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
          Create New Password
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          Enter and confirm your new secure password
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mt-7 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white dark:bg-[#111a2b] py-8 px-6 shadow-xl shadow-slate-200/50 dark:shadow-soft-dark border border-slate-200 dark:border-[#1f2a3d] rounded-3xl sm:px-10">
          {isVerifying ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Verifying recovery session...
              </p>
            </div>
          ) : !isLinkValid ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/50 rounded-2xl flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Link Expired or Invalid
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {error || 'This password reset link has expired or has already been used.'}
              </p>
              <div className="pt-2">
                <Link
                  to="/forgot-password"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors min-h-[44px]"
                >
                  Request New Reset Link
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Password Updated!
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Your password has been successfully updated. Redirecting you to sign in...
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors min-h-[44px]"
                >
                  Go to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              {/* New Password */}
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="new-password"
                    name="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    className="block w-full pl-10 pr-11 py-2.5 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 transition-colors min-h-[44px] hover:border-slate-400 dark:hover:border-slate-600 focus-visible:border-indigo-600 dark:focus-visible:border-indigo-400"
                    placeholder="At least 8 characters (letters & numbers)"
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 min-h-[44px] min-w-[44px] justify-center"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    className="block w-full pl-10 pr-11 py-2.5 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 transition-colors min-h-[44px] hover:border-slate-400 dark:hover:border-slate-600 focus-visible:border-indigo-600 dark:focus-visible:border-indigo-400"
                    placeholder="Re-enter new password"
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 min-h-[44px] min-w-[44px] justify-center"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center min-h-[44px]"
                  loading={isSubmitting}
                  disabled={!isConfigured || isSubmitting}
                  icon={ArrowRight}
                >
                  Update Password
                </Button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
