// Removes the parts of a picture that can carry where and when it was taken, on the server (3.1.0
// plan, Personal controls). The browser already re-draws pictures before upload (scale-picture.ts),
// but a request sent another way would arrive with its camera data intact, so every stored picture
// passes through here too. Only metadata blocks are dropped; the picture data itself is copied
// byte for byte, so nothing is re-compressed.
//
// JPEG: APP1 (Exif, which holds GPS, and XMP), APP13 (Photoshop/IPTC) and comment blocks go.
// PNG: eXIf, tEXt, zTXt, iTXt and tIME chunks go. WebP: EXIF and XMP chunks go, with the VP8X
// header's flags and the file size corrected. Anything not recognized as one of the three comes
// back unchanged; the upload routes have already refused other types.

const JPEG_DROP = new Set([0xe1, 0xed, 0xfe]);
const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
const WEBP_DROP = new Set(['EXIF', 'XMP ']);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

// Markers that stand alone, with no length field after them.
function isStandaloneMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function stripJpeg(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let at = 2;
  while (at + 4 <= bytes.byteLength) {
    if (bytes[at] !== 0xff) return bytes; // Not a block boundary: leave the file as it came.
    const marker = bytes[at + 1];
    if (marker === 0xff) {
      at += 1; // Fill byte.
      continue;
    }
    if (isStandaloneMarker(marker)) {
      parts.push(bytes.subarray(at, at + 2));
      at += 2;
      continue;
    }
    if (marker === 0xda) {
      parts.push(bytes.subarray(at)); // Start of the picture data: everything after it is kept.
      return concat(parts);
    }
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    const end = at + 2 + length;
    if (length < 2 || end > bytes.byteLength) return bytes;
    if (!JPEG_DROP.has(marker)) parts.push(bytes.subarray(at, end));
    at = end;
  }
  parts.push(bytes.subarray(at));
  return concat(parts);
}

function stripPng(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let at = 8;
  while (at + 12 <= bytes.byteLength) {
    const length = view.getUint32(at);
    const end = at + 12 + length;
    if (end > bytes.byteLength) return bytes;
    const type = ascii(bytes, at + 4, 4);
    if (!PNG_DROP.has(type)) parts.push(bytes.subarray(at, end));
    at = end;
    if (type === 'IEND') break;
  }
  return concat(parts);
}

function stripWebp(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Uint8Array[] = [];
  let at = 12;
  while (at + 8 <= bytes.byteLength) {
    const size = view.getUint32(at + 4, true);
    const end = at + 8 + size + (size % 2);
    if (end > bytes.byteLength + 1) return bytes;
    const fourcc = ascii(bytes, at, 4);
    if (!WEBP_DROP.has(fourcc)) {
      const chunk = bytes.slice(at, Math.min(end, bytes.byteLength));
      // VP8X flags: bit 3 says EXIF is present and bit 2 says XMP is; both are now gone.
      if (fourcc === 'VP8X' && chunk.byteLength > 8) chunk[8] &= ~0x0c;
      chunks.push(chunk);
    }
    at = end;
  }
  const body = concat(chunks);
  const header = bytes.slice(0, 12);
  new DataView(header.buffer).setUint32(4, body.byteLength + 4, true);
  return concat([header, body]);
}

export function stripPictureMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.byteLength >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return stripJpeg(bytes);
  if (bytes.byteLength >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return stripPng(bytes);
  if (bytes.byteLength >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return stripWebp(bytes);
  return bytes;
}
