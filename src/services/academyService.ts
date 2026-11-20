import { supabase } from '../lib/supabase';
import type { AcademySettings, AcademySettingsFormData } from '../types';

export async function getAcademySettings(): Promise<{
  settings: AcademySettings | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('academy_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch academy settings:', error);
      }
      return { settings: null, error: error.message };
    }

    return { settings: data as AcademySettings, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query academy settings';
    return { settings: null, error: msg };
  }
}

/**
 * Validates and uploads an academy logo image to the "academy-assets" storage bucket.
 * Multi-tenant isolation: {auth.uid()}/logos/...
 * Restricts to JPG, PNG, WEBP and max 2 MB.
 */
export async function uploadAcademyLogo(
  file: File
): Promise<{ url: string | null; error: string | null }> {
  try {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      return { url: null, error: 'Invalid file format. Please upload a JPG, PNG, or WebP image.' };
    }

    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { url: null, error: 'File size exceeds 2 MB limit. Please select a smaller image.' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { url: null, error: 'Unauthorized: You must be logged in to upload an academy logo.' };
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `${user.id}/logos/logo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('academy-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      return { url: null, error: uploadError.message };
    }

    const { data: urlData } = supabase.storage
      .from('academy-assets')
      .getPublicUrl(filePath);

    return { url: urlData.publicUrl, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to upload logo';
    return { url: null, error: msg };
  }
}

/**
 * Updates the academy_settings record for the authenticated owner.
 */
export async function updateAcademySettings(
  idOrFormData: string | Partial<AcademySettings>,
  maybeFormData?: Partial<AcademySettings> | AcademySettingsFormData
): Promise<{ settings: AcademySettings | null; error: string | null }> {
  try {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const data: Partial<AcademySettings> =
      typeof idOrFormData === 'string'
        ? (maybeFormData as Partial<AcademySettings>) || {}
        : idOrFormData;
    const id = typeof idOrFormData === 'string' ? idOrFormData : undefined;

    if (data.academy_name !== undefined) payload.academy_name = data.academy_name.trim();
    if (data.logo_url !== undefined) payload.logo_url = data.logo_url;
    if (data.contact_number !== undefined) payload.contact_number = data.contact_number?.trim() || null;
    if (data.email !== undefined) payload.email = data.email?.trim() || null;
    if (data.address !== undefined) payload.address = data.address?.trim() || null;
    if (data.default_monthly_fee !== undefined) {
      payload.default_monthly_fee = Math.max(0, Math.round(Number(data.default_monthly_fee) || 0));
    }
    if (data.payment_due_day !== undefined) {
      payload.payment_due_day = Math.max(1, Math.min(28, Math.round(Number(data.payment_due_day) || 5)));
    }
    if (data.working_hours_config !== undefined) payload.working_hours_config = data.working_hours_config;
    if (data.is_onboarding_completed !== undefined) payload.is_onboarding_completed = data.is_onboarding_completed;
    if (data.upi_id !== undefined) payload.upi_id = data.upi_id ? data.upi_id.trim().toLowerCase() : null;
    if (data.upi_payee_name !== undefined) payload.upi_payee_name = data.upi_payee_name ? data.upi_payee_name.trim().slice(0, 60) : null;
    if (data.upi_qr_path !== undefined) payload.upi_qr_path = data.upi_qr_path;
    if (data.footer_credit !== undefined) payload.footer_credit = data.footer_credit ? data.footer_credit.trim() : null;

    let query = supabase.from('academy_settings').update(payload);

    if (id) {
      query = query.eq('id', id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        query = query.eq('owner_id', user.id);
      }
    }

    const { data: updated, error } = await query.select().single();

    if (error) {
      return { settings: null, error: error.message };
    }

    return { settings: updated as AcademySettings, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update academy settings';
    return { settings: null, error: msg };
  }
}

/**
 * Uploads a UPI QR code image (or generated QR Blob) to {auth.uid()}/upi/qr.png
 * in the academy-assets bucket. Only the owner can read or write it.
 */
export async function uploadUpiQrCode(
  fileOrBlob: File | Blob
): Promise<{ path: string | null; url: string | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { path: null, url: null, error: 'Unauthorized: You must be logged in to upload a UPI QR code.' };
    }

    const maxSizeBytes = 2 * 1024 * 1024;
    if (fileOrBlob.size > maxSizeBytes) {
      return { path: null, url: null, error: 'File size exceeds 2 MB limit. Please select or generate a smaller image.' };
    }

    const filePath = `${user.id}/upi/qr.png`;

    const { error: uploadError } = await supabase.storage
      .from('academy-assets')
      .upload(filePath, fileOrBlob, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      return { path: null, url: null, error: uploadError.message };
    }

    const { data: urlData } = supabase.storage
      .from('academy-assets')
      .getPublicUrl(filePath);

    return { path: filePath, url: urlData.publicUrl, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to upload UPI QR code';
    return { path: null, url: null, error: msg };
  }
}

/**
 * Removes the stored UPI QR code from {auth.uid()}/upi/qr.png in academy-assets.
 */
export async function deleteUpiQrCode(): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: You must be logged in.' };
    }

    const filePath = `${user.id}/upi/qr.png`;
    const { error } = await supabase.storage.from('academy-assets').remove([filePath]);
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete UPI QR code';
    return { success: false, error: msg };
  }
}
