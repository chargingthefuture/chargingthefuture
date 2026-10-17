'use client';

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/nextjs';
import { getHostedSignInUrl } from './clerk-env';
import { dropBrowserPushWhenSignedOut } from 'lib/notifications/browser-signed-out';

/**
 * Provider-agnostic authentication context and types.
 * This abstraction allows swapping auth providers without breaking consumers.
 */

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
  signIn: () => Promise<void> | void;
  // `redirectUrl` is where the browser goes once the session is gone. Without it the provider's own
  // after-sign-out setting applies.
  signOut: (options?: { redirectUrl?: string }) => Promise<void> | void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Clerk-based auth provider implementation.
 * Provides provider-agnostic interface for consumers.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerkAuth();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (isClerkLoaded && clerkUser) {
      setUser({
        id: clerkUser.id,
        username: clerkUser.username,
        email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
        provider: 'clerk',
      });
    } else if (isClerkLoaded && !clerkUser) {
      setUser(null);
      // Nobody is signed in, so this browser should not keep showing the last member's notifications.
      void dropBrowserPushWhenSignedOut();
    }
  }, [clerkUser, isClerkLoaded]);

  const handleSignIn = async () => {
    const signInUrl = getHostedSignInUrl();
    if (signInUrl) {
      window.location.href = signInUrl;
    }
  };

  const handleSignOut = async (options?: { redirectUrl?: string }) => {
    await clerkSignOut(options?.redirectUrl ? { redirectUrl: options.redirectUrl } : undefined);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        provider: user?.provider ?? null,
        isLoading: !isClerkLoaded,
        isAuthenticated: !!user,
        signIn: handleSignIn,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context.
 * Provider-agnostic: works with any auth provider implementation.
 *
 * @throws {Error} if used outside of AuthProvider
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, signIn } = useAuth();
 *
 * if (!isAuthenticated) {
 *   return <button onClick={signIn}>Sign In</button>;
 * }
 * ```
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
