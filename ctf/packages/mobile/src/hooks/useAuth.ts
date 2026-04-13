import { useState, useEffect } from 'react';
import { authenticatePluginUser, AuthProvider } from '@ctf/shared';

export interface AuthUser {
  id: string;
  username?: string | null;
  email?: string | null;
  isAdmin?: boolean;
  isApproved?: boolean;
  provider?: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [provider, setProvider] = useState<AuthProvider>('custom');
  const [token, setToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const authResult = await authenticatePluginUser({ provider, token });
      if (authResult.isAuthenticated) {
        setUser({
          id: authResult.userId || 'unknown',
          provider: authResult.provider,
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    })();
  }, [provider, token]);

  const signIn = async () => {
    // Example: setProvider('clerk'); setToken('...');
    // Not implemented
  };
  const signOut = async () => {
    setUser(null);
    setToken(undefined);
  };

  const isAuthenticated = !!user;
  return { user, isLoading, isAuthenticated, signIn, signOut };
}
