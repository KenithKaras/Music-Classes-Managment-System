import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const GENERIC_ERROR = 'Unable to create payment link.';

// Development-only logger: logs only when ENVIRONMENT equals exactly "development".
// Never logs tokens, hashes, or request bodies beyond the fee ID.
function logDev(reason: string, feeId?: string) {
  if (Deno.env.get('ENVIRONMENT') === 'development') {
    if (feeId) {
      console.warn(`[create-payment-link dev] ${reason} (fee_id: ${feeId})`);
    } else {
      console.warn(`[create-payment-link dev] ${reason}`);
    }
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

  // If APP_ORIGIN is missing, return 500 with a generic error
  if (!appOrigin) {
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // CORS: allow only APP_ORIGIN
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
    // 1. Requires a valid logged-in user JWT. Reject otherwise.
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

    // 2. Input: { fee_id } only. Reject any other field, including amount, UPI ID, or payee name.
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      logDev('invalid input: unable to parse JSON body');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      logDev('invalid input: expected JSON object');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== 'fee_id') {
      logDev('invalid input: expected fee_id only');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const feeId = typeof body.fee_id === 'string' ? body.fee_id.trim() : '';
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!feeId || !uuidRegex.test(feeId)) {
      logDev('invalid fee_id format');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Load the fee where owner_id matches the caller.
    const { data: fee, error: feeError } = await supabase
      .from('monthly_fees')
      .select('id, amount_due, billing_month, owner_id')
      .eq('id', feeId)
      .eq('owner_id', user.id)
      .single();

    if (feeError || !fee) {
      logDev('fee not found', feeId);
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Balance = amount_due minus the sum of payments for that fee. Reject if balance is 0 or less.
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount')
      .eq('monthly_fee_id', feeId)
      .eq('owner_id', user.id);

    if (paymentsError) {
      logDev('payments lookup failed', feeId);
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const totalPaid = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const balance = (fee.amount_due || 0) - totalPaid;

    if (balance <= 0) {
      logDev('balance zero', feeId);
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Load upi_id, upi_payee_name, and academy name from caller's academy_settings. Reject if upi_id is missing.
    const { data: settings, error: settingsError } = await supabase
      .from('academy_settings')
      .select('upi_id, upi_payee_name, academy_name')
      .eq('owner_id', user.id)
      .single();

    if (settingsError || !settings || !settings.upi_id || !settings.upi_id.trim()) {
      logDev('settings missing', feeId);
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const upiId = settings.upi_id.trim();
    const payeeName = (
      settings.upi_payee_name?.trim() ||
      settings.academy_name?.trim() ||
      'MIX with Me Classes'
    ).slice(0, 60);

    // Note: "Music fees <Mon YYYY>" from the fee's billing month. Never include a student name, phone, or ID.
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let note = 'Music fees';
    if (fee.billing_month) {
      const parts = fee.billing_month.split('-');
      if (parts.length >= 2) {
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        if (monthIdx >= 0 && monthIdx < 12 && /^\d{4}$/.test(year)) {
          note = `Music fees ${months[monthIdx]} ${year}`;
        }
      }
    }
    note = note.slice(0, 80);

    // 5. Generate a 32-byte random token with crypto.getRandomValues, base64url encoded.
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const token = toBase64Url(randomBytes);

    // Store only its SHA-256 hex hash, computed with crypto.subtle.digest.
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const amountPaise = Math.round(balance * 100);

    const { error: insertError } = await supabase.from('payment_links').insert({
      owner_id: user.id,
      fee_id: fee.id,
      amount_paise: amountPaise,
      note,
      upi_id: upiId,
      payee_name: payeeName,
      token_hash: tokenHash,
      status: 'active',
      expires_at: expiresAt,
    });

    if (insertError) {
      logDev('insert failed', feeId);
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return { url: "<APP_ORIGIN>/pay?t=<token>" }
    const payUrl = `${appOrigin}/pay?t=${token}`;

    return new Response(JSON.stringify({ url: payUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    logDev('unexpected exception in create-payment-link');
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
