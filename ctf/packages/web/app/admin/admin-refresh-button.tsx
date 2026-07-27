'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

// Refresh control for the admin landing page (owner request, 2026-07-27).
//
// The landing is a server component: its per-area "new to review" dots come from
// getAdminAreaAttention() at render time, so once the page is open those dots go out of date as work
// arrives. router.refresh() re-runs the server render in place — it keeps scroll position and does
// not clear client state, which a full browser reload would.
//
// The spin is driven by useTransition, so it lasts exactly as long as the server round-trip rather
// than a guessed timeout. It also disables the button, so an impatient double-tap cannot queue a
// second refresh on top of the first.
export function AdminRefreshButton({ accent = '#6366F1' }: { accent?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Announced to screen readers after a refresh completes. Without it the refresh is silent for
  // anyone not watching the dots — the page looks identical when nothing changed.
  const [announcement, setAnnouncement] = useState('');

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAnnouncement('');
          startTransition(() => {
            router.refresh();
            setAnnouncement('Admin areas refreshed.');
          });
        }}
        disabled={pending}
        aria-label="Refresh the admin areas"
        title="Refresh"
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${accent}1A`,
          border: `1px solid ${accent}4D`,
          color: accent,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          flexShrink: 0,
          cursor: pending ? 'default' : 'pointer',
          opacity: pending ? 0.6 : 1,
        }}
      >
        <RefreshCw size={18} aria-hidden="true" style={pending ? { animation: 'ctf-spin 0.9s linear infinite' } : undefined} />
      </button>
      <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {announcement}
      </span>
    </>
  );
}
