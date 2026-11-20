/**
 * File upload validation and client-side image compression utilities.
 * Enforces magic-byte verification, MIME type matching, and 2MB limits.
 */

export const MAX_FILE_SIZE_BYTES = 2097152; // 2 MB
export const COMPRESSION_THRESHOLD_BYTES = 1572864; // 1.5 MB

export type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Inspects binary magic bytes to determine the true image format:
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - WebP: RIFF (bytes 0-3: 0x52, 0x49, 0x46, 0x46) and WEBP (bytes 8-11: 0x57, 0x45, 0x42, 0x50)
 */
export function detectImageMimeType(bytes: Uint8Array): AllowedImageMime | null {
  if (!bytes || bytes.length < 12) {
    return null;
  }

  // Check JPEG (FF D8 FF)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // Check PNG (89 50 4E 47 0D 0A 1A 0A)
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

  // Check WebP (RIFF .... WEBP)
  const isRiff =
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46; // F

  const isWebp =
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50; // P

  if (isRiff && isWebp) {
    return 'image/webp';
  }

  return null;
}

/**
 * Validates file size, declared MIME type, and binary magic bytes.
 */
export function validateImageUpload(
  sizeBytes: number,
  declaredMime: string,
  bytes: Uint8Array
): { isValid: boolean; error?: string; mimeType?: AllowedImageMime } {
  if (sizeBytes <= 0) {
    return { isValid: false, error: 'File is empty.' };
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { isValid: false, error: 'File size must be 2 MB or less.' };
  }

  const detectedMime = detectImageMimeType(bytes);
  if (!detectedMime) {
    return { isValid: false, error: 'Unsupported file format. Please upload JPEG, PNG, or WebP.' };
  }

  // The Content-Type header / declared type and magic bytes must agree
  const normalizedDeclared = declaredMime.toLowerCase().trim();
  if (normalizedDeclared !== detectedMime) {
    // Treat image/jpg and image/jpeg as matching JPEG
    const isJpegMatch =
      detectedMime === 'image/jpeg' &&
      (normalizedDeclared === 'image/jpeg' || normalizedDeclared === 'image/jpg');

    if (!isJpegMatch) {
      return { isValid: false, error: 'File content does not match its declared type.' };
    }
  }

  return { isValid: true, mimeType: detectedMime };
}

/**
 * Client-side browser image compression:
 * If an image exceeds 1.5 MB, re-encodes to JPEG quality 0.8 with max dimension 1600px via canvas.toBlob.
 * Never calls fetch() on data URLs.
 */
export async function compressImageIfLarge(file: File): Promise<Blob> {
  if (file.size <= COMPRESSION_THRESHOLD_BYTES) {
    return file;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1600;
        const maxHeight = 1600;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.8
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
