import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const GENERIC_ERROR = 'Unable to upload enrollment photo.';
const MAX_FILE_SIZE = 2097152; // 2 MB
const MAX_REQUEST_SIZE = 2100000; // 2.1 MB

function logDev(reason: string) {
  if (Deno.env.get('ENVIRONMENT') === 'development') {
    console.warn(`[upload-enrollment-photo dev] ${reason}`);
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
    const submissionId = formData.get('submission_id');
    const file = formData.get('file');

    if (
      typeof token !== 'string' ||
      typeof submissionId !== 'string' ||
      !(file instanceof File)
    ) {
      logDev('invalid form fields: expected token, submission_id, and file');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanToken = token.trim();
    const cleanSubmissionId = submissionId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!/^[A-Za-z0-9_-]{40,50}$/.test(cleanToken) || !uuidRegex.test(cleanSubmissionId)) {
      logDev('invalid token or submission_id format');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      logDev('invalid file size');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const tokenHash = await sha256Hex(cleanToken);
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Look up submission and verify it matches the enrollment link token
    const { data: submission, error: subError } = await supabaseAdmin
      .from('enrollment_submissions')
      .select('id, owner_id, enrollment_link_id, photo_path, status')
      .eq('id', cleanSubmissionId)
      .single();

    if (subError || !submission) {
      logDev('submission not found');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reject if photo is already set or submission is not pending (allowed only once per pending submission)
    if (submission.photo_path || submission.status !== 'pending') {
      logDev('photo already uploaded or submission is not pending');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify token matches the enrollment link
    const { data: link, error: linkError } = await supabaseAdmin
      .from('enrollment_links')
      .select('id, token_hash')
      .eq('id', submission.enrollment_link_id)
      .eq('token_hash', tokenHash)
      .single();

    if (linkError || !link) {
      logDev('token does not match submission enrollment link');
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ext = detectedMime === 'image/png' ? 'png' : detectedMime === 'image/webp' ? 'webp' : 'jpg';
    const randomId = getRandom16Chars();
    const storagePath = `${submission.owner_id}/${submission.id}/${randomId}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('enrollment-photos')
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

    const { error: updateError } = await supabaseAdmin
      .from('enrollment_submissions')
      .update({ photo_path: storagePath })
      .eq('id', submission.id);

    if (updateError) {
      logDev('submission update failed - deleting uploaded photo');
      await supabaseAdmin.storage.from('enrollment-photos').remove([storagePath]);
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
    logDev('unexpected exception in upload-enrollment-photo');
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
