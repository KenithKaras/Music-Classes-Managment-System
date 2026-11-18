import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mapAuthError, validatePasswordStrength } from '../utils/authUtils';
import { queryClient } from '../lib/queryClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  inactivityWarning: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
    phone?: string
  ) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  dismissInactivityWarning: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
const INACTIVITY_WARNING_MS = 59 * 60 * 1000; // 59 minutes (1 minute before auto logout)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [inactivityWarning, setInactivityWarning] = useState(false);

  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dismissInactivityWarning = useCallback(() => {
    lastActivityRef.current = Date.now();
    setInactivityWarning(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Error signing out:', err);
      }
    } finally {
      setUser(null);
      setSession(null);
      setInactivityWarning(false);
      // Clear all cached server queries
      queryClient.clear();
      // Clear persistent theme and local caches
      try {
        const theme = localStorage.getItem('mix_theme');
        localStorage.clear();
        if (theme) localStorage.setItem('mix_theme', theme);
      } catch {
        // LocalStorage access fallback
      }
    }
  }, []);

  // 60-Minute Inactivity Auto-Logout with 1-Minute Advance Warning
  useEffect(() => {
    if (!user) {
      if (timerRef.current) clearInterval(timerRef.current);
      setInactivityWarning(false);
      return;
    }

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      if (inactivityWarning) {
        setInactivityWarning(false);
      }
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetActivity, { passive: true }));

    // Check inactivity every 10 seconds for timely warning at 59 min and logout at 60 min
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        setInactivityWarning(false);
        signOut();
      } else if (elapsed >= INACTIVITY_WARNING_MS) {
        setInactivityWarning(true);
      } else if (inactivityWarning) {
        setInactivityWarning(false);
      }
    }, 10000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetActivity));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, inactivityWarning, signOut]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Check active sessions on app boot
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.error('Supabase getSession error:', err);
        }
        setLoading(false);
      });

    // Listen for changes on auth state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_OUT') {
        queryClient.clear();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return {
        error:
          'Supabase credentials are not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (import.meta.env.DEV) {
          console.error('[Supabase Auth Error]:', error);
        }
        return { error: mapAuthError(error.message) };
      }

      lastActivityRef.current = Date.now();
      setInactivityWarning(false);
      if (import.meta.env.DEV) {
        console.info('[Supabase Auth Success]: User logged in', data.user?.email);
      }

      return { error: null };
    } catch (err: unknown) {
      if (import.meta.env.DEV) {
        console.error('[Supabase Auth Unexpected Exception]:', err);
      }
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during sign in.';
      return { error: mapAuthError(message) };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    phone?: string
  ): Promise<{ error: string | null; needsEmailConfirmation?: boolean }> => {
    if (!isSupabaseConfigured) {
      return {
        error: 'Supabase credentials are not configured.',
      };
    }

    const strengthCheck = validatePasswordStrength(password);
    if (!strengthCheck.isValid) {
      return { error: strengthCheck.error };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName?.trim() || '',
            phone: phone?.trim() || '',
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        if (import.meta.env.DEV) {
          console.error('[Supabase SignUp Error]:', error);
        }
        return { error: mapAuthError(error.message) };
      }

      const needsEmailConfirmation = !data.session;
      return { error: null, needsEmailConfirmation };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during registration.';
      return { error: mapAuthError(message) };
    }
  };

  const resetPasswordForEmail = async (email: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase credentials are not configured.' };
    }

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        if (import.meta.env.DEV) {
          console.error('[Supabase resetPasswordForEmail Error]:', error);
        }
        // If rate limited or offline, map error; otherwise do not reveal account non-existence
        const mapped = mapAuthError(error.message);
        if (mapped === 'Too many attempts. Try again in a few minutes.' || mapped === 'You appear to be offline.') {
          return { error: mapped };
        }
      }

      // Always return null error so caller shows generic message preventing account enumeration
      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed';
      return { error: mapAuthError(msg) };
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase credentials are not configured.' };
    }

    const strengthCheck = validatePasswordStrength(newPassword);
    if (!strengthCheck.isValid) {
      return { error: strengthCheck.error };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        if (import.meta.env.DEV) {
          console.error('[Supabase updateUser Password Error]:', error);
        }
        return { error: mapAuthError(error.message) };
      }

      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      return { error: mapAuthError(msg) };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: isSupabaseConfigured,
        inactivityWarning,
        signIn,
        signUp,
        signOut,
        resetPasswordForEmail,
        updatePassword,
        dismissInactivityWarning,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
