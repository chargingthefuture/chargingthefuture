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
export declare function verifyClerkToken(token: string): string | null;
