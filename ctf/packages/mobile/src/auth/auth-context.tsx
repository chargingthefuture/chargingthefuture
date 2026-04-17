import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { authenticatePluginUser, AuthProvider as SharedAuthProvider } from '@ctf/shared';

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
  signOut: () => Promise<void> | void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [provider, setProvider] = useState<SharedAuthProvider>('custom');
  const [token, setToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const authResult = await authenticatePluginUser({ provider, token });
        if (!isMounted) return;
        if (authResult.isAuthenticated) {
          setUser({
            id: authResult.userId || 'unknown',
            provider: authResult.provider,
          });
        } else {
          setUser(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [provider, token]);

  const handleSignIn = async () => {
    Alert.alert('Sign-in not yet implemented.');
  };

  const handleSignOut = async () => {
    setUser(null);
    setToken(undefined);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        provider,
        isLoading,
        isAuthenticated: !!user,
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
