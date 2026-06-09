// Clerk authentication logic for genericPluginAuth.
import { jwtDecode } from 'jwt-decode';

export interface ClerkJWTPayload {
  sub?: string;
  sid?: string;
  [key: string]: unknown;
}

/**
 * A real, cryptographic Clerk token verifier. Supplied by the server (web),
 * which can import Clerk's server SDK (`@clerk/backend`). It returns the verified
 * user id, or null when the token is missing/invalid/expired.
 *
 * This package stays runtime-neutral (it is also bundled into the React Native
 * app), so it does NOT import a server-only SDK itself; instead a verifier is
 * injected at the call site.
 */
export type ClerkTokenVerifier = (token: string) => Promise<string | null> | string | null;

/**
 * DECODE-ONLY structural check. Reads the `sub` claim WITHOUT verifying the
 * signature, so it can be forged trivially.
 *
 * SECURITY: never use this to authenticate a request. It exists only for
 * non-security uses (e.g. reading a claim for display/telemetry). Real
 * authentication must verify the signature server-side — see
 * `lib/auth/verify-bearer.ts` in the web package, which uses
 * `@clerk/backend`'s `verifyToken`.
 */
export function decodeClerkTokenSubject(token: string): string | null {
  if (!token) {
    return null;
  }
  try {
    const decoded = jwtDecode<ClerkJWTPayload>(token);
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * @deprecated Renamed to {@link decodeClerkTokenSubject} to make clear it does
 * NOT verify the signature. Kept as an alias so existing imports keep compiling;
 * do not use it for authentication.
 */
export const verifyClerkToken = decodeClerkTokenSubject;
