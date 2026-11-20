import { describe, it, expect } from 'vitest';
import {
  detectImageMimeType,
  validateImageUpload,
  MAX_FILE_SIZE_BYTES,
} from './fileUploadUtils';

describe('fileUploadUtils - Magic-byte inspection & validation', () => {
  // Helper byte arrays
  const validJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const validPngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const validWebpBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x24, 0x00, 0x00, 0x00, // length
    0x57, 0x45, 0x42, 0x50, // WEBP
  ]);
  const randomBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]);

  it('detects valid JPEG magic bytes', () => {
    expect(detectImageMimeType(validJpegBytes)).toBe('image/jpeg');
  });

  it('detects valid PNG magic bytes', () => {
    expect(detectImageMimeType(validPngBytes)).toBe('image/png');
  });

  it('detects valid WebP magic bytes', () => {
    expect(detectImageMimeType(validWebpBytes)).toBe('image/webp');
  });

  it('returns null for unknown binary data or short buffers', () => {
    expect(detectImageMimeType(randomBytes)).toBeNull();
    expect(detectImageMimeType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(detectImageMimeType(new Uint8Array(0))).toBeNull();
  });

  it('accepts real JPEG file with image/jpeg Content-Type', () => {
    const result = validateImageUpload(1024, 'image/jpeg', validJpegBytes);
    expect(result.isValid).toBe(true);
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('accepts real PNG file with image/png Content-Type', () => {
    const result = validateImageUpload(2048, 'image/png', validPngBytes);
    expect(result.isValid).toBe(true);
    expect(result.mimeType).toBe('image/png');
  });

  it('accepts real WebP file with image/webp Content-Type', () => {
    const result = validateImageUpload(4096, 'image/webp', validWebpBytes);
    expect(result.isValid).toBe(true);
    expect(result.mimeType).toBe('image/webp');
  });

  it('rejects a PNG payload disguised with an image/jpeg Content-Type', () => {
    // Magic bytes are PNG, but Content-Type declares JPEG
    const result = validateImageUpload(1024, 'image/jpeg', validPngBytes);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('does not match');
  });

  it('rejects empty files (0 bytes)', () => {
    const result = validateImageUpload(0, 'image/jpeg', validJpegBytes);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('rejects oversize files (> 2 MB)', () => {
    const result = validateImageUpload(MAX_FILE_SIZE_BYTES + 1, 'image/jpeg', validJpegBytes);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('2 MB');
  });

  it('rejects non-image files such as plain text or PDF with spoofed header', () => {
    const fakeHeader = 'image/jpeg';
    const textBytes = new TextEncoder().encode('Hello world, this is a plain text file pretending to be JPEG');
    const result = validateImageUpload(textBytes.length, fakeHeader, textBytes);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Unsupported file format');
  });
});
