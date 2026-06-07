import type { ClerkTokenVerifier } from './clerkAuth';
// Canonical generic plugin authentication logic
// This module provides a generic, provider-agnostic authentication handler for plugin auth consistency.
//
// Usage: Import and use `authenticatePluginUser` in plugin routes or services to enforce consistent auth logic.
//
// This is the single source of truth for plugin authentication logic. Do not reimplement provider-specific logic in plugins.

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
export async function authenticatePluginUser(context: PluginAuthContext): Promise<PluginAuthResult> {
  switch (context.provider) {
    case 'clerk': {
      if (!context.token) {
        return { isAuthenticated: false, provider: 'clerk', error: 'No token provided' };
      }
      // SECURITY: a Clerk token is only trusted when a real verifier is supplied.
      // There is no decode-only fallback, because an unsigned/forged token would
      // otherwise pass. See lib/auth/verify-bearer.ts in the web package for the
      // server-side verifier.
      if (!context.verifier) {
        return {
          isAuthenticated: false,
          provider: 'clerk',
          error: 'No verifier supplied; refusing to trust an unverified token',
        };
      }
      const userId = await context.verifier(context.token);
      if (userId) {
        return { isAuthenticated: true, provider: 'clerk', userId };
      }
      return { isAuthenticated: false, provider: 'clerk', error: 'Invalid token' };
    }
    case 'supabase':
      // TODO: Implement Supabase auth logic here
      return { isAuthenticated: false, provider: 'supabase', error: 'Not implemented' };
    case 'firebase':
      // TODO: Implement Firebase auth logic here
      return { isAuthenticated: false, provider: 'firebase', error: 'Not implemented' };
    case 'custom':
      // TODO: Implement custom auth logic here
      return { isAuthenticated: false, provider: 'custom', error: 'Not implemented' };
    default:
      return { isAuthenticated: false, provider: context.provider, error: 'Unknown provider' };
  }
}

// Extend this module as new providers or requirements emerge.
