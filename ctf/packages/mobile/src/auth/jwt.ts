/**
 * Minimal JWT (signed token) claim reader for the mobile app.
 *
 * This ONLY decodes the payload to display the signed-in user's name/role in the
 * app UI. It does NOT verify the signature — verification is the backend's job
 * (`@clerk/backend`'s verifyToken in lib/auth/verify-bearer.ts). Never make a
 * trust decision in the app based on these claims; the backend is the authority.
 */

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const globalAtob = (globalThis as { atob?: (_input: string) => string }).atob;
  if (typeof globalAtob === 'function') {
    return globalAtob(padded);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const char of padded.replace(/=+$/, '')) {
    const index = chars.indexOf(char);
    if (index === -1) continue;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

/** Decodes the JWT payload to a claims object, or null when it cannot be parsed. */
export function decodeJwtClaims(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = decodeBase64Url(parts[1]);
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
