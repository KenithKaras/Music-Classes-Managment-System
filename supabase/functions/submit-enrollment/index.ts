import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const GENERIC_ERROR = 'This registration link is no longer valid. Ask the academy for a new link.';

function logDev(reason: string) {
  if (Deno.env.get('ENVIRONMENT') === 'development') {
    console.warn(`[submit-enrollment dev] ${reason}`);
  }
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
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      logDev('failed to parse JSON input');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      logDev('input is not a valid JSON object');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Allowed keys only
    const allowedKeys = [
      'token',
      'child_name',
      'parent_name',
      'parent_phone',
      'parent_email',
      'address',
      'preferred_batch',
      'consent',
    ];
    for (const key of Object.keys(body)) {
      if (!allowedKeys.includes(key)) {
        logDev(`unrecognized key in submission: ${key}`);
        return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Field-level validations
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      logDev('invalid token format');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const childName = typeof body.child_name === 'string' ? body.child_name.trim() : '';
    if (childName.length < 2 || childName.length > 80) {
      logDev('invalid child_name length');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parentName = typeof body.parent_name === 'string' ? body.parent_name.trim() : '';
    if (parentName.length < 2 || parentName.length > 80) {
      logDev('invalid parent_name length');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawPhone = typeof body.parent_phone === 'string' ? body.parent_phone.trim() : '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      logDev('invalid parent_phone: must be a 10-digit Indian mobile number');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parentEmail: string | null = null;
    if (body.parent_email !== undefined && body.parent_email !== null) {
      if (typeof body.parent_email !== 'string') {
        logDev('invalid parent_email type');
        return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const trimmedEmail = body.parent_email.trim();
      if (trimmedEmail) {
        if (trimmedEmail.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
          logDev('invalid parent_email format');
          return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        parentEmail = trimmedEmail;
      }
    }

    let address: string | null = null;
    if (body.address !== undefined && body.address !== null) {
      if (typeof body.address !== 'string' || body.address.trim().length > 300) {
        logDev('invalid address');
        return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      address = body.address.trim() || null;
    }

    let preferredBatch: string | null = null;
    if (body.preferred_batch !== undefined && body.preferred_batch !== null) {
      if (typeof body.preferred_batch !== 'string' || body.preferred_batch.trim().length > 60) {
        logDev('invalid preferred_batch');
        return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      preferredBatch = body.preferred_batch.trim() || null;
    }

    if (body.consent !== true) {
      logDev('missing required consent');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up enrollment_link by token_hash with service role
    const tokenHash = await sha256Hex(token);
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: link, error: linkError } = await supabaseAdmin
      .from('enrollment_links')
      .select('id, owner_id, status, expires_at, max_submissions, submissions_count')
      .eq('token_hash', tokenHash)
      .single();

    if (linkError || !link) {
      logDev('enrollment link not found');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isExpired = new Date(link.expires_at).getTime() <= Date.now();
    if (link.status !== 'active' || isExpired || link.submissions_count >= link.max_submissions) {
      logDev('enrollment link inactive, expired, or full');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Atomically increment submissions_count with safety check
    const { data: updatedLink, error: updateError } = await supabaseAdmin
      .from('enrollment_links')
      .update({ submissions_count: link.submissions_count + 1 })
      .eq('id', link.id)
      .lt('submissions_count', link.max_submissions)
      .select('id')
      .single();

    if (updateError || !updatedLink) {
      logDev('atomic submissions limit reached during update');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert enrollment_submissions record
    const { data: submission, error: insertError } = await supabaseAdmin
      .from('enrollment_submissions')
      .insert({
        owner_id: link.owner_id,
        enrollment_link_id: link.id,
        child_name: childName,
        parent_name: parentName,
        parent_phone: cleanPhone,
        parent_email: parentEmail,
        address,
        preferred_batch: preferredBatch,
        consent_at: new Date().toISOString(),
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !submission) {
      logDev('submission insert failed');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, submission_id: submission.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    logDev('unexpected exception in submit-enrollment');
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
