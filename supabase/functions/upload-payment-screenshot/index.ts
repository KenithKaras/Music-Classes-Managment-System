import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const GENERIC_ERROR = 'Unable to upload payment screenshot.';
const MAX_FILE_SIZE = 2097152; // 2 MB
const MAX_REQUEST_SIZE = 2100000; // 2.1 MB preliminary limit

function logDev(reason: string) {
  if (Deno.env.get('ENVIRONMENT') === 'development') {
    console.warn(`[upload-payment-screenshot dev] ${reason}`);
  }
}

async function sha256Hex(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getRandom16Chars(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function detectImageMime(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  const isRiff =
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const isWebp =
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;

  if (isRiff && isWebp) {
    return 'image/webp';
  }

  return null;
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

  // Reject oversized requests before parsing multipart
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    logDev('request exceeded maximum content length');
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await req.formData();
    const token = formData.get('token');
    const file = formData.get('file');

    // Exactly two fields: token and file
    let fieldCount = 0;
    for (const _ of formData.keys()) {
      fieldCount++;
    }
    if (fieldCount !== 2 || typeof token !== 'string' || !(file instanceof File)) {
      logDev('invalid form fields: expected exactly token and file');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanToken = token.trim();
    if (!/^[A-Za-z0-9_-]{40,50}$/.test(cleanToken)) {
      logDev('invalid token format');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // File size verification (1 byte to 2,097,152 bytes)
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      logDev('invalid file size');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Binary magic bytes inspection
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const detectedMime = detectImageMime(bytes);
    if (!detectedMime) {
      logDev('unsupported or unrecognized magic bytes');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Content-Type header and magic bytes must agree
    const declaredType = (file.type || '').toLowerCase().trim();
    const isJpegMatch =
      detectedMime === 'image/jpeg' &&
      (declaredType === 'image/jpeg' || declaredType === 'image/jpg');
    if (declaredType !== detectedMime && !isJpegMatch) {
      logDev('mismatch between Content-Type header and binary magic bytes');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash token and look up active payment link via service role
    const tokenHash = await sha256Hex(cleanToken);
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: link, error: linkError } = await supabaseAdmin
      .from('payment_links')
      .select('id, owner_id, status, expires_at, screenshot_uploaded_at')
      .eq('token_hash', tokenHash)
      .single();

    if (linkError || !link) {
      logDev('payment link not found');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Link must be active, not expired, and screenshot not already uploaded
    const isExpired = new Date(link.expires_at).getTime() <= Date.now();
    if (link.status !== 'active' || isExpired || link.screenshot_uploaded_at) {
      logDev('payment link inactive, expired, or screenshot already uploaded');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate random 16-char ID and determine extension
    const ext = detectedMime === 'image/png' ? 'png' : detectedMime === 'image/webp' ? 'webp' : 'jpg';
    const randomId = getRandom16Chars();
    const storagePath = `${link.owner_id}/${link.id}/${randomId}.${ext}`;

    // Upload with service role
    const { error: uploadError } = await supabaseAdmin.storage
      .from('payment-screenshots')
      .upload(storagePath, bytes, {
        contentType: detectedMime,
        upsert: false,
      });

    if (uploadError) {
      logDev('storage upload failed');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert database record and update payment_links
    const { error: insertError } = await supabaseAdmin.from('payment_screenshots').insert({
      owner_id: link.owner_id,
      payment_link_id: link.id,
      storage_path: storagePath,
      mime_type: detectedMime,
      size_bytes: file.size,
      status: 'pending',
    });

    if (insertError) {
      logDev('database record insertion failed - deleting uploaded file');
      await supabaseAdmin.storage.from('payment-screenshots').remove([storagePath]);
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from('payment_links')
      .update({ screenshot_uploaded_at: new Date().toISOString() })
      .eq('id', link.id);

    if (updateError) {
      logDev('link timestamp update failed - deleting uploaded file');
      await supabaseAdmin.storage.from('payment-screenshots').remove([storagePath]);
      await supabaseAdmin.from('payment_screenshots').delete().eq('payment_link_id', link.id);
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    logDev('unexpected exception in upload-payment-screenshot');
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
