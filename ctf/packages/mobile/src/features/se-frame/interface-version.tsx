// Which interface the signed-in member sees, 3.0 or 3.1, read from and saved to the same
// /api/account/ui-preferences the web uses, so the choice follows the account across web and
// Android. Until the read answers, and whenever it fails, the member stays on 3.0.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { isSeInterfaceVersion, SE_DEFAULT_INTERFACE_VERSION, type SeInterfaceVersion } from '@ctf/shared';
import { authedFetch } from '../../auth/authedFetch';
import { useAuth } from '../../auth/auth-context';
import { reportError } from '../../observability/report';

const PREFERENCES_PATH = '/api/account/ui-preferences';

type InterfaceVersionValue = {
  version: SeInterfaceVersion;
  saving: boolean;
  error: string | null;
  /** Resolves true once the choice is saved. */
  switchTo: (_next: SeInterfaceVersion) => Promise<boolean>;
};

const InterfaceVersionContext = createContext<InterfaceVersionValue | null>(null);

async function readMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown } | null;
    if (body && typeof body.message === 'string' && body.message) return body.message;
  } catch {
    // no-trace: the body is not JSON; the fallback sentence is shown.
  }
  return fallback;
}

export function InterfaceVersionProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [version, setVersion] = useState<SeInterfaceVersion>(SE_DEFAULT_INTERFACE_VERSION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    setVersion(SE_DEFAULT_INTERFACE_VERSION);
    if (!isAuthenticated || !userId) return;
    let live = true;
    authedFetch(PREFERENCES_PATH)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status !== 401) {
            reportError(new Error(`GET ${PREFERENCES_PATH} answered ${res.status}`), {
              area: 'se-frame',
              op: 'interface_version_read',
              extra: { status: res.status },
            });
          }
          return;
        }
        const body = (await res.json()) as { interfaceVersion?: unknown };
        if (live && isSeInterfaceVersion(body.interfaceVersion)) setVersion(body.interfaceVersion);
      })
      .catch((caught: unknown) => reportError(caught, { area: 'se-frame', op: 'interface_version_read' }));
    return () => {
      live = false;
    };
  }, [isAuthenticated, userId]);

  const switchTo = useCallback(async (next: SeInterfaceVersion) => {
    setSaving(true);
    setError(null);
    const fallback = `Could not switch to ${next}.`;
    try {
      const res = await authedFetch(PREFERENCES_PATH, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ interfaceVersion: next }),
      });
      if (!res.ok) {
        setError(await readMessage(res, fallback));
        return false;
      }
      setVersion(next);
      return true;
    } catch (caught) {
      reportError(caught, { area: 'se-frame', op: 'interface_switch' });
      setError(fallback);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return (
    <InterfaceVersionContext.Provider value={{ version, saving, error, switchTo }}>{children}</InterfaceVersionContext.Provider>
  );
}

export function useInterfaceVersion(): InterfaceVersionValue {
  const value = useContext(InterfaceVersionContext);
  if (!value) throw new Error('useInterfaceVersion must be used inside InterfaceVersionProvider.');
  return value;
}
