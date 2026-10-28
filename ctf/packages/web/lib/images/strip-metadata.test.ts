import { describe, expect, it } from 'vitest';
import { stripPictureMetadata } from './strip-metadata';

const text = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const has = (bytes: Uint8Array, s: string) => Buffer.from(bytes).includes(Buffer.from(s, 'latin1'));

function jpegSegment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}

function pngChunk(type: string, data: number[]): number[] {
  const n = data.length;
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff, ...text(type), ...data, 0, 0, 0, 0];
}

function webpChunk(fourcc: string, data: number[]): number[] {
  const n = data.length;
  return [...text(fourcc), n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff, ...data, ...(n % 2 ? [0] : [])];
}

describe('stripPictureMetadata', () => {
  it('drops Exif, Photoshop and comment blocks from a JPEG and keeps the picture data', () => {
    const jpeg = Uint8Array.from([
      0xff, 0xd8,
      ...jpegSegment(0xe0, text('JFIF\0')),
      ...jpegSegment(0xe1, text('Exif\0\0GPSLatitude')),
      ...jpegSegment(0xed, text('Photoshop 3.0 location')),
      ...jpegSegment(0xfe, text('taken at home')),
      ...jpegSegment(0xdb, [0, 1, 2, 3]),
      ...jpegSegment(0xda, [1, 2, 3]),
      0x11, 0x22, 0xff, 0x00, 0x33,
      0xff, 0xd9,
    ]);
    const out = stripPictureMetadata(jpeg);
    expect(has(out, 'GPSLatitude')).toBe(false);
    expect(has(out, 'location')).toBe(false);
    expect(has(out, 'taken at home')).toBe(false);
    expect(has(out, 'JFIF')).toBe(true);
    expect(Array.from(out.slice(-7))).toEqual([0x11, 0x22, 0xff, 0x00, 0x33, 0xff, 0xd9]);
  });

  it('drops text, time and Exif chunks from a PNG', () => {
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
      ...pngChunk('tEXt', text('Location\0home')),
      ...pngChunk('eXIf', text('GPSLatitude')),
      ...pngChunk('tIME', [7, 234, 10, 28, 1, 2, 3]),
      ...pngChunk('IDAT', [1, 2, 3]),
      ...pngChunk('IEND', []),
    ]);
    const out = stripPictureMetadata(png);
    expect(has(out, 'Location')).toBe(false);
    expect(has(out, 'GPSLatitude')).toBe(false);
    expect(has(out, 'tIME')).toBe(false);
    expect(has(out, 'IHDR')).toBe(true);
    expect(has(out, 'IDAT')).toBe(true);
    expect(has(out, 'IEND')).toBe(true);
  });

  it('drops EXIF and XMP chunks from a WebP, clears their flags and fixes the size', () => {
    const body = [
      ...text('WEBP'),
      ...webpChunk('VP8X', [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ...webpChunk('VP8L', [1, 2, 3, 4, 5]),
      ...webpChunk('EXIF', text('GPSLatitude')),
      ...webpChunk('XMP ', text('<x:location/>')),
    ];
    const n = body.length;
    const webp = Uint8Array.from([...text('RIFF'), n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff, ...body]);
    const out = stripPictureMetadata(webp);
    expect(has(out, 'GPSLatitude')).toBe(false);
    expect(has(out, 'location')).toBe(false);
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    expect(view.getUint32(4, true)).toBe(out.byteLength - 8);
    expect(out[20]).toBe(0);
    expect(has(out, 'VP8L')).toBe(true);
  });

  it('leaves anything else alone', () => {
    const other = Uint8Array.from(text('GIF89a'));
    expect(stripPictureMetadata(other)).toBe(other);
  });
});
