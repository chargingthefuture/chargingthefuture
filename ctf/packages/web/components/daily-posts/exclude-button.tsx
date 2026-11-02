'use client';

import { useState } from 'react';
import type { ShellTokens } from './types';

// Leave a post out of the rotation, its theme groups and Today's stories, or bring it back. The
// post stays on the blog either way.

type Props = { t: ShellTokens; label: string; onPress: () => Promise<string | null> };

export function ExcludeButton({ t, label, onPress }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function press() {
    setBusy(true);
    const failure = await onPress();
    setBusy(false);
    setMessage(failure);
  }
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => void press()}
        style={{ background: 'none', border: 'none', color: t.MUTED, fontSize: 11.5, padding: '4px 0 0', cursor: 'pointer', textDecoration: 'underline' }}
      >
        {label}
      </button>
      {message && (
        <p role="alert" style={{ fontSize: 12, color: '#F87171', margin: '4px 0 0' }}>
          {message}
        </p>
      )}
    </>
  );
}
