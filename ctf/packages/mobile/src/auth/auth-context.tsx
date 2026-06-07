import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { Alert, Linking } from 'react-native';
import Constants from 'expo-constants';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-expo';
import { registerAuthTokenGetter } from './authedFetch';

export interface AuthUser {
  id: string;
  username?: string | null;
  email?: string | null;
  isAdmin?: boolean;
  isApproved?: boolean;
  provider?: string | null;
}

export interface AuthContextType {
  user: AuthUser | null;
  provider: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Fetch the current Clerk session token (JWT), or null when signed out. */
  getToken: () => Promise<string | null>;
  signIn: () => Promise<void> | void;
  signOut: () => Promise<void> | void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type RuntimeConfig = {
  authProvider?: string;
  signInUrl?: string;
  appUrl?: string;
};

function getRuntimeConfig(): RuntimeConfig {
  return (Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? {}) as RuntimeConfig;
}

/**
 * AuthProvider — derives the signed-in user from a real Clerk session.
 *
 * Must be rendered inside Clerk's <ClerkProvider> (see App.tsx). It reads the
 * session via Clerk's `useAuth`/`useUser`, exposes a `getToken()` accessor for
 * API modules, and registers that accessor with the centralized `authedFetch`
 * helper so every backend call carries a verifiable `Authorization: Bearer`
 * token. There is no baked identity.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, getToken, signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useUser();

  const stableGetToken = useCallback(async () => {
    try {
      return await getToken();
    } catch {
      return null;
    }
  }, [getToken]);

  // Make the live Clerk token available to the plain (non-React) API modules.
  useEffect(() => {
    registerAuthTokenGetter(isSignedIn ? stableGetToken : null);
    return () => registerAuthTokenGetter(null);
  }, [isSignedIn, stableGetToken]);

  const user = useMemo<AuthUser | null>(() => {
    if (!isSignedIn || !clerkUser) return null;
    const metadata = (clerkUser.publicMetadata ?? {}) as Record<string, unknown>;
    const role = typeof metadata.role === 'string' ? metadata.role.toLowerCase() : null;
    const approved = metadata.is_approved ?? metadata.isApproved;
    return {
      id: clerkUser.id,
      username: clerkUser.username ?? null,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
      isAdmin: role === 'admin',
      isApproved:
        typeof approved === 'boolean'
          ? approved
          : ['1', 'true', 'yes', 'approved'].includes(String(approved ?? '').toLowerCase()),
      provider: getRuntimeConfig().authProvider ?? 'clerk',
    };
  }, [isSignedIn, clerkUser]);

  const handleSignIn = useCallback(async () => {
    // Headless-friendly: send the user to Clerk's hosted sign-in page. Clerk's
    // hosted Account Portal handles the full sign-in/sign-up flow in the system
    // browser and returns to the app; no per-screen native UI is required.
    const signInUrl = getRuntimeConfig().signInUrl;
    if (signInUrl) {
      try {
        await Linking.openURL(signInUrl);
        return;
      } catch {
        // fall through to the alert below
      }
    }
    Alert.alert(
      'Sign in',
      'Set NEXT_PUBLIC_AUTH_SIGN_IN_URL to your hosted Clerk sign-in page to enable sign-in from the app.',
    );
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await clerkSignOut();
    } finally {
      registerAuthTokenGetter(null);
    }
  }, [clerkSignOut]);

  return (
    <AuthContext.Provider
      value={{
        user,
        provider: user?.provider ?? getRuntimeConfig().authProvider ?? 'clerk',
        isLoading: !isLoaded,
        isAuthenticated: Boolean(isSignedIn && user),
        getToken: stableGetToken,
        signIn: handleSignIn,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
