import type { ClerkTokenVerifier } from './clerkAuth';
export type AuthProvider = 'clerk' | 'supabase' | 'firebase' | 'custom';
export interface PluginAuthContext {
    provider: AuthProvider;
    token?: string;
    userId?: string;
    /**
     * A real, cryptographic Clerk token verifier supplied by the caller (the web
     * server passes one backed by `@clerk/backend`). REQUIRED to authenticate the
     * `clerk` provider: without it, a Clerk token is NOT trusted. This keeps the
     * shared package free of any server-only SDK while still refusing to
     * authenticate on an unverified (forgeable) token.
     */
    verifier?: ClerkTokenVerifier;
}
export interface PluginAuthResult {
    isAuthenticated: boolean;
    userId?: string;
    error?: string;
    provider: AuthProvider;
}
/**
 * Generic plugin authentication handler.
 *
 * @param context - The authentication context, including provider and credentials.
 * @returns PluginAuthResult indicating authentication status and user info.
 */
export declare function authenticatePluginUser(context: PluginAuthContext): Promise<PluginAuthResult>;
