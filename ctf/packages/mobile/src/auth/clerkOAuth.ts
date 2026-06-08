import Constants from 'expo-constants';

/**
 * Hosted-OAuth sign-in helpers for the mobile app — no `@clerk/clerk-js`.
 *
 * The mobile app signs in by running a standard OAuth 2.0 authorization-code
 * flow with PKCE (Proof Key for Code Exchange — a way to do OAuth safely from a
 * public client that cannot keep a secret) against Clerk, which acts as an
 * OpenID Connect provider. The flow returns an OpenID Connect `id_token`: a JWT
 * (signed token) issued and signed by the same Clerk instance keys that sign web
 * session tokens. The backend verifies that `id_token` with
 * `@clerk/backend`'s `verifyToken` (keyed by AUTH_SECRET_KEY) exactly as it
 * verifies a web session token — same signing keys, `sub` = the Clerk user id.
 *
 * This file only derives the endpoints/config; the React flow lives in
 * auth-context.tsx (it must use the expo-auth-session hooks).
 */

type RuntimeExtra = {
  authPublishableKey?: string;
  signInUrl?: string;
  appUrl?: string;
};

function getRuntimeExtra(): RuntimeExtra {
  return (Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? {}) as RuntimeExtra;
}

/**
 * Decodes a base64 string in a React Native runtime that has no `atob`.
 * Clerk publishable keys embed the Frontend API host as base64.
 */
function decodeBase64(value: string): string {
  // Hermes/RN expose global.atob in recent SDKs; fall back to a manual decoder.
  const globalAtob = (globalThis as { atob?: (_input: string) => string }).atob;
  if (typeof globalAtob === 'function') {
    return globalAtob(value);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const char of value.replace(/=+$/, '')) {
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

/**
 * Derives the Clerk Frontend API origin (e.g. `https://clerk.example.com`) from
 * the publishable key. The key is `pk_test_<base64>` / `pk_live_<base64>`, where
 * the base64 payload decodes to the Frontend API host with a trailing `$`.
 * Returns null when the key is missing or malformed.
 */
export function getClerkFrontendApiOrigin(): string | null {
  const key = getRuntimeExtra().authPublishableKey?.trim();
  if (!key) return null;
  const match = /^pk_(test|live)_(.+)$/.exec(key);
  if (!match) return null;
  let host: string;
  try {
    host = decodeBase64(match[2]).replace(/\$+$/, '').trim();
  } catch {
    return null;
  }
  if (!host) return null;
  return `https://${host}`;
}

/**
 * Builds the OpenID Connect discovery + token endpoints from the Frontend API
 * origin. Clerk serves OAuth 2.0 / OpenID Connect at the Frontend API host:
 *   - authorization: `<origin>/oauth/authorize`
 *   - token:         `<origin>/oauth/token`
 * Returns null when the publishable key cannot be resolved.
 */
export function getClerkOAuthEndpoints(): {
  authorizationEndpoint: string;
  tokenEndpoint: string;
} | null {
  const origin = getClerkFrontendApiOrigin();
  if (!origin) return null;
  return {
    authorizationEndpoint: `${origin}/oauth/authorize`,
    tokenEndpoint: `${origin}/oauth/token`,
  };
}

/**
 * The OAuth application client id to use for the native flow. Clerk's native
 * OAuth client id is configured in the dashboard and supplied via
 * NEXT_PUBLIC_AUTH_SIGN_IN_URL's sibling env. We read it from `extra.signInUrl`
 * only as a fallback hint; the real value comes from EXPO_PUBLIC config below.
 */
export function getClerkOAuthClientId(): string | null {
  const id =
    process.env.EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID ??
    (Constants.expoConfig?.extra as { oauthClientId?: string } | undefined)?.oauthClientId;
  const trimmed = typeof id === 'string' ? id.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}
