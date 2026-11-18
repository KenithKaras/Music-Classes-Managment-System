import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const missingEnvVars: string[] = [];

if (!rawUrl || rawUrl.trim() === '' || rawUrl === 'https://your-project-ref.supabase.co') {
  missingEnvVars.push('VITE_SUPABASE_URL');
}

if (!rawKey || rawKey.trim() === '' || rawKey === 'your-anon-public-api-key' || rawKey === 'your-anon-key-here') {
  missingEnvVars.push('VITE_SUPABASE_ANON_KEY');
}

export const isSupabaseConfigured = missingEnvVars.length === 0;

// Safe fallback URL/key to prevent createClient from crashing during module import
const validUrl = isSupabaseConfigured ? rawUrl : 'https://placeholder.supabase.co';
const validKey = isSupabaseConfigured ? rawKey : 'placeholder-key';

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
