import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Music2, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ThemeToggle } from '../components/ThemeToggle';
import { normalizeIndianPhone, PHONE_INPUT_HINT } from '../utils/formUtils';
import { validatePasswordStrength } from '../utils/authUtils';

export const RegisterPage: React.FC = () => {
  const { signUp, isConfigured, user } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successConfirmation, setSuccessConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    const strengthCheck = validatePasswordStrength(password);
    if (!strengthCheck.isValid) {
      setError(strengthCheck.error);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    let normalizedPhone = '';
    if (phone.trim()) {
      const clean = normalizeIndianPhone(phone);
      if (!clean) {
        setError('Please enter a valid 10-digit mobile number (+91 is optional).');
        return;
      }
      normalizedPhone = clean;
    }

    setLoading(true);

    try {
      const res = await signUp(email, password, fullName, normalizedPhone);
      if (res.error) {
        setError(res.error);
      } else if (res.needsEmailConfirmation) {
        setSuccessConfirmation(true);
      } else {
        // Logged in directly
        navigate('/');
      }
    } finally {
      setLoading(false);
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
          to={user ? '/dashboard' : '/'}
          aria-label={user ? 'Go to dashboard' : 'Go to home'}
          className="inline-flex items-center gap-2.5 group"
        >
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
            <Music2 className="w-6 h-6" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-xl tracking-tight">
            MIX with Me Classes
          </span>
        </Link>

        <h2 className="mt-6 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Create Your Music Academy
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Set up in minutes. Your data stays 100% private to your academy.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white dark:bg-[#111a2b] py-8 px-5 sm:px-10 shadow-xl shadow-slate-200/50 dark:shadow-soft-dark border border-slate-200 dark:border-[#1f2a3d] rounded-3xl">
          {successConfirmation ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Check your email to confirm your account.
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                We sent a confirmation link to{' '}
                <strong className="text-slate-900 dark:text-white">{email}</strong>.
                Click the link in your email to activate your academy account, then log in.
              </p>
              <div className="pt-3">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full justify-center min-h-[44px]"
                  onClick={() => navigate('/login')}
                >
                  Proceed to Login
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                label="Full Name / Teacher Name"
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="teacher@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />

              <Input
                label="Phone Number (Optional)"
                type="tel"
                placeholder="e.g. 9876543210"
                helperText={PHONE_INPUT_HINT}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 8 characters (letters & numbers)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="p-1 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <Input
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="p-1 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center min-h-[44px]"
                  loading={loading}
                  disabled={!isConfigured || loading}
                  icon={ArrowRight}
                >
                  Create Academy Account
                </Button>
              </div>

              <div className="flex items-center gap-2 pt-2 text-[11px] text-slate-500 dark:text-slate-400 justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>End-to-end data isolation with PostgreSQL RLS</span>
              </div>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center min-h-[44px]"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
