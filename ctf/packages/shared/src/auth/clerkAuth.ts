// Clerk authentication logic for genericPluginAuth
import { jwtDecode } from 'jwt-decode';

export interface ClerkJWTPayload {
  sub?: string;
  sid?: string;
  [key: string]: unknown;
}

/**
 * Verifies Clerk JWT and returns user ID if valid.
 * @param token Clerk JWT
 * @returns userId or null
 *
 * This performs lightweight client-side JWT parsing and structure validation.
 * Full cryptographic verification should be done server-side with Clerk's SDK.
 * See: https://clerk.com/docs/backend-requests/handling/jwt-verification
 */
export function verifyClerkToken(token: string): string | null {
  if (!token) {
    return null;
  }

  try {
    const decoded = jwtDecode<ClerkJWTPayload>(token);

    if (!decoded.sub) {
      return null;
    }

    return decoded.sub;
  } catch {
    return null;
  }
}
