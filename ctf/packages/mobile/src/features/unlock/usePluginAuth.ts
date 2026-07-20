// React Native hook for generic plugin authentication.
// Uses the canonical shared logic for plugin auth. Co-located in the unlock feature
// because AdminUnlock is its only remaining consumer after the native app was narrowed
// to its keep-list (rule 105); it was previously housed under the now-removed
// peer-programming feature but is not peer-programming-specific.

import { useEffect, useState } from 'react';
import { authenticatePluginUser, PluginAuthContext, PluginAuthResult } from '@ctf/shared';

export function usePluginAuth(provider: PluginAuthContext['provider'], token?: string) {
  const [auth, setAuth] = useState<PluginAuthResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authenticatePluginUser({ provider, token })
      .then((result) => {
        setAuth(result);
        setLoading(false);
      })
      .catch(() => {
        setAuth({ isAuthenticated: false, provider, error: 'Auth failed' });
        setLoading(false);
      });
  }, [provider, token]);

  return { auth, loading };
}
