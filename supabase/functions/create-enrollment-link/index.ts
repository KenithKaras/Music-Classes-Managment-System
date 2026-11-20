import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const GENERIC_ERROR = 'Unable to create registration link.';

function logDev(reason: string) {
  if (Deno.env.get('ENVIRONMENT') === 'development') {
    console.warn(`[create-enrollment-link dev] ${reason}`);
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sha256Hex(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  const appOrigin = (Deno.env.get('APP_ORIGIN') ?? '').replace(/\/+$/, '');

  if (!appOrigin) {
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': appOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logDev('unauthorized: missing or invalid authorization header');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      logDev('unauthorized: invalid user token');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Input validation: { max_submissions, expires_in_days } only
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is allowed, defaults will apply
    }

    const allowedKeys = ['max_submissions', 'expires_in_days'];
    for (const key of Object.keys(body)) {
      if (!allowedKeys.includes(key)) {
        logDev(`invalid key in input: ${key}`);
        return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let maxSubmissions = 5;
    if (body.max_submissions !== undefined) {
      if (
        typeof body.max_submissions !== 'number' ||
        !Number.isInteger(body.max_submissions) ||
        body.max_submissions < 1 ||
        body.max_submissions > 20
      ) {
        logDev('invalid max_submissions: must be an integer between 1 and 20');
        return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      maxSubmissions = body.max_submissions;
    }

    let expiresInDays = 7;
    if (body.expires_in_days !== undefined) {
      if (
        typeof body.expires_in_days !== 'number' ||
        !Number.isInteger(body.expires_in_days) ||
        body.expires_in_days < 1 ||
        body.expires_in_days > 30
      ) {
        logDev('invalid expires_in_days: must be an integer between 1 and 30');
        return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      expiresInDays = body.expires_in_days;
    }

    // Generate 32-byte crypto random token and compute SHA-256 hash
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const token = toBase64Url(randomBytes);
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { error: insertError } = await supabaseAdmin.from('enrollment_links').insert({
      owner_id: user.id,
      token_hash: tokenHash,
      status: 'active',
      expires_at: expiresAt,
      max_submissions: maxSubmissions,
      submissions_count: 0,
    });

    if (insertError) {
      logDev('database insert failed');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const enrollUrl = `${appOrigin}/enroll/${token}`;
    return new Response(JSON.stringify({ url: enrollUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    logDev('unexpected exception in create-enrollment-link');
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
