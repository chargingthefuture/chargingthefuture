import { describe, expect, it } from 'vitest';
import { parseCommunityImageDimension, sniffCommunityImageType } from './community-images';

describe('sniffCommunityImageType', () => {
  it('reads PNG, JPEG and WebP from their first bytes', () => {
    expect(sniffCommunityImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffCommunityImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffCommunityImageType(webp)).toBe('image/webp');
  });

  it('refuses anything else, whatever it claims to be', () => {
    expect(sniffCommunityImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffCommunityImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
    // RIFF with a different format (a WAV file) is not a WebP.
    expect(sniffCommunityImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
    expect(sniffCommunityImageType(new Uint8Array([]))).toBeNull();
  });
});

describe('parseCommunityImageDimension', () => {
  it('accepts whole numbers from 1 to 4096', () => {
    expect(parseCommunityImageDimension('1600')).toBe(1600);
    expect(parseCommunityImageDimension('1')).toBe(1);
    expect(parseCommunityImageDimension('4096')).toBe(4096);
  });

  it('refuses anything outside that', () => {
    expect(parseCommunityImageDimension('0')).toBeNull();
    expect(parseCommunityImageDimension('4097')).toBeNull();
    expect(parseCommunityImageDimension('abc')).toBeNull();
    expect(parseCommunityImageDimension(null)).toBeNull();
  });
});
