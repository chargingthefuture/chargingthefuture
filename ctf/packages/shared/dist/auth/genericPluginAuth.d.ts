export type AuthProvider = 'clerk' | 'supabase' | 'firebase' | 'custom';
export interface PluginAuthContext {
    provider: AuthProvider;
    token?: string;
    userId?: string;
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
