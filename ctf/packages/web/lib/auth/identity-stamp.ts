import { getConfiguredAuthProvider } from './provider-env';

// The middleware writes the `x-ctf-*` identity headers, and the rest of the app trusts them. That
// trust only holds on requests the middleware actually ran on, and its matcher skips any path that
// looks like a static file, so on those paths a client-sent `x-ctf-*` header would reach the app
// untouched. The middleware therefore also writes this stamp, and identity is read from the headers
// only when the stamp matches. A client cannot produce it: it is a digest of the auth provider's
// secret key, which never leaves the server. The digest, not the key, travels in the header so a
// logged request does not carry the key itself.
export const IDENTITY_STAMP_HEADER = 'x-ctf-identity-stamp';

let cached: { secretKey: string; stamp: Promise<string> } | null = null;

async function digest(secretKey: string): Promise<string> {
  const data = new TextEncoder().encode(`ctf-identity-stamp:${secretKey}`);
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Null when no auth secret is configured. Without one nobody can sign in, so there is no identity
// to trust and callers treat the request as signed out.
export async function getIdentityStamp(): Promise<string | null> {
  const secretKey = getConfiguredAuthProvider()?.secretKey;
  if (!secretKey) {
    return null;
  }
  if (!cached || cached.secretKey !== secretKey) {
    cached = { secretKey, stamp: digest(secretKey) };
  }
  return cached.stamp;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export async function hasValidIdentityStamp(headerStore: Headers): Promise<boolean> {
  const received = headerStore.get(IDENTITY_STAMP_HEADER);
  if (!received) {
    return false;
  }
  const expected = await getIdentityStamp();
  return expected !== null && constantTimeEqual(received, expected);
}
