'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SeInterfaceVersion } from '@ctf/shared';
import { failureText, responseFailureText } from 'lib/errors/client-failure';

// Saves which interface the member sees (3.0 or 3.1) and reloads the home screen into it.
export function useInterfaceSwitch() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(interfaceVersion: SeInterfaceVersion) {
    setSaving(true);
    setError(null);
    const fallback = `Could not switch to ${interfaceVersion}.`;
    try {
      const res = await fetch('/api/account/ui-preferences', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ interfaceVersion }),
      });
      if (!res.ok) {
        setError(await responseFailureText(res, fallback, 'member'));
        return;
      }
      router.push('/');
      router.refresh();
    } catch (caught) {
      setError(failureText(caught, { area: 'se-frame', op: 'interface_switch', fallback, audience: 'member' }));
    } finally {
      setSaving(false);
    }
  }

  return { switchTo, saving, error };
}
