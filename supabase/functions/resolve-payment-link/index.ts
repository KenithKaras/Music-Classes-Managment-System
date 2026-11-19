import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const GENERIC_ERROR = 'This payment link is invalid or has expired.';

async function sha256Hex(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  const appOrigin = (Deno.env.get('APP_ORIGIN') ?? '').replace(/\/+$/, '');

  // If APP_ORIGIN is missing, return 500 with a generic error
  if (!appOrigin) {
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // CORS: allow only APP_ORIGIN. Never reflect the request Origin header.
  const corsHeaders = {
    'Access-Control-Allow-Origin': appOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Keep OPTIONS handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Reject other methods
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Input: POST JSON { token } only
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== 'token') {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = typeof body.token === 'string' ? body.token.trim() : '';

    // Validate token format (base64url, expected length: 32 bytes = 43 chars)
    const tokenRegex = /^[A-Za-z0-9_-]{40,50}$/;
    if (!token || !tokenRegex.test(token)) {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash it (never log the token)
    const tokenHash = await sha256Hex(token);

    // Look up token_hash with service role key from the function's environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: link, error: dbError } = await supabaseAdmin
      .from('payment_links')
      .select('payee_name, upi_id, amount_paise, note, status, expires_at')
      .eq('token_hash', tokenHash)
      .single();

    if (dbError || !link) {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Require status = 'active' and expires_at > now()
    if (link.status !== 'active') {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const expiresAtMs = new Date(link.expires_at).getTime();
    if (isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return only { payee_name, upi_id, amount: "1500.00", note }
    const amountStr = (link.amount_paise / 100).toFixed(2);

    return new Response(
      JSON.stringify({
        payee_name: link.payee_name,
        upi_id: link.upi_id,
        amount: amountStr,
        note: link.note,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch {
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
