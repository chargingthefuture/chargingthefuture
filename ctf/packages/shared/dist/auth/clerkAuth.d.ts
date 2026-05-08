/**
 * Verifies Clerk JWT and returns user ID if valid.
 * @param token Clerk JWT
 * @returns userId or null
 *
 * Note: Server-side JWT verification is handled in @ctf/web.
 * This stub satisfies the shared package contract for mobile/plugin consumers.
 */
export declare function verifyClerkToken(_token: string): string | null;
