/**
 * Verifies Clerk JWT and returns user ID if valid.
 * @param token Clerk JWT
 * @returns userId or null
 */
export declare function verifyClerkToken(token: string): string | null;
