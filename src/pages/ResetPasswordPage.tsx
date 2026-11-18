import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Music2, Lock, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
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
    const { error: resetError } = await updatePassword(password);
    setIsSubmitting(false);

    if (resetError) {
      setError(resetError);
    } else {
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
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
          Set a new password
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-[#a9b4c7]">
          Create a secure password with at least 8 characters
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mt-6 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white dark:bg-[#131c2e] py-7 px-6 shadow-sm border border-slate-200 dark:border-[#26324a] rounded-2xl sm:px-8">
          {isVerifying ? (
            <div className="py-8 text-center text-slate-500 dark:text-[#a9b4c7] text-sm">
              <div className="w-6 h-6 border-2 border-slate-200 dark:border-[#26324a] border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
              Verifying reset token...
            </div>
          ) : !isLinkValid ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#f1f5f9]">
                Reset Link Expired or Invalid
              </h2>
              <p className="text-sm text-slate-600 dark:text-[#a9b4c7]">
                {error || 'This recovery link is no longer valid. Please request a new link.'}
              </p>
              <div className="pt-2">
                <Link to="/forgot-password">
                  <Button variant="primary" className="w-full justify-center min-h-[44px]">
                    Request New Link
                  </Button>
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#f1f5f9]">
                Password Updated!
              </h2>
              <p className="text-sm text-slate-600 dark:text-[#a9b4c7]">
                Your password has been changed successfully. Redirecting you to sign in...
              </p>
              <div className="pt-2">
                <Link to="/login">
                  <Button variant="primary" className="w-full justify-center min-h-[44px]">
                    Sign In Now
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              <div>
                <label
                  htmlFor="new-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-[#a9b4c7] mb-1.5"
                >
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-[#a9b4c7]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="new-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-11 py-2.5 rounded-xl text-sm border border-slate-300 dark:border-[#26324a] bg-white dark:bg-[#1a2540] text-slate-900 dark:text-[#f1f5f9] placeholder-slate-400 dark:placeholder-slate-500 hover:border-slate-400 dark:hover:border-slate-500 focus-visible:border-indigo-600 dark:focus-visible:border-indigo-400 transition-colors min-h-[44px]"
                    placeholder="At least 8 characters"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-[#f1f5f9] min-h-[44px] min-w-[44px] justify-center"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-[#a9b4c7] mb-1.5"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-[#a9b4c7]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-11 py-2.5 rounded-xl text-sm border border-slate-300 dark:border-[#26324a] bg-white dark:bg-[#1a2540] text-slate-900 dark:text-[#f1f5f9] placeholder-slate-400 dark:placeholder-slate-500 hover:border-slate-400 dark:hover:border-slate-500 focus-visible:border-indigo-600 dark:focus-visible:border-indigo-400 transition-colors min-h-[44px]"
                    placeholder="Re-enter new password"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-[#f1f5f9] min-h-[44px] min-w-[44px] justify-center"
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

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#26324a] text-center">
            <Link
              to="/login"
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center min-h-[44px]"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
