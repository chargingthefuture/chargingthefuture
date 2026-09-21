'use client';

import { Fragment, createContext, useCallback, useContext, useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

// Re-pull the current admin screen without closing and reopening the app (owner report, 2026-09-19).
//
// The reported failure: a Quora URL was added from the Unlock sign-ups list, the queue tab was
// opened to approve it, and the new submission was not there. The screen had been rendered before
// the row existed and nothing on it re-read the data. The installed web app runs in standalone
// display mode, which turns off the browser's pull-to-refresh, so the only way back to current data
// was to close the app and open it again.
//
// A refresh here has to cover both ways an admin screen gets its data, because the screens are
// split roughly evenly between them:
//
//  - Server-rendered screens (Unlock, Skills Hunt, Service Credits …) read in the page component and
//    pass the result down as props. `router.refresh()` re-runs that server render in place.
//  - Client-fetched screens (Directory, Beacon, Comic, Peer Programming …) call their API routes
//    from a useEffect. `router.refresh()` does nothing for those, so the provider also changes the
//    key on a Fragment wrapping the entire admin subtree, which remounts it and re-runs those
//    effects. A keyed Fragment emits no DOM of its own, so no layout or sticky positioning changes.
//
// The remount resets in-screen state (open tab, filter chips, typed search). That is the same thing
// closing and reopening the app did, and it is what the control is standing in for.

type AdminRefreshValue = {
  // Re-read the screen. Safe to call again while one is in flight — the button is disabled, but a
  // programmatic caller cannot queue a second pass either.
  refresh: () => void;
  pending: boolean;
};

const AdminRefreshContext = createContext<AdminRefreshValue | null>(null);

// Null outside an /admin screen. Callers treat that as "no refresh control here" rather than
// falling back to something weaker, so a control can never render doing half the job.
export function useAdminRefresh(): AdminRefreshValue | null {
  return useContext(AdminRefreshContext);
}

export function AdminRefreshProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState(0);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    if (pending) return;
    startTransition(() => {
      router.refresh();
      // A transition update, so it commits together with the new server render rather than
      // remounting the subtree against the data that is already on screen.
      setToken((current) => current + 1);
    });
  }, [pending, router]);

  // The pending flag and the announcement live here, outside the keyed Fragment, so the remount
  // below cannot wipe them mid-refresh — the button inside the screen is remounted, and reads both
  // back from this context.
  return (
    <AdminRefreshContext.Provider value={{ refresh, pending }}>
      <Fragment key={token}>{children}</Fragment>
      <AdminRefreshAnnouncement token={token} />
    </AdminRefreshContext.Provider>
  );
}

// Spoken to a screen reader once a refresh has landed. Without it the control is silent for anyone
// not watching the rows: when nothing changed, the screen looks identical afterwards.
function AdminRefreshAnnouncement({ token }: { token: number }) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (token === 0) return;
    setMessage('Screen refreshed.');
    // Cleared so a second refresh is announced again rather than reading as unchanged text.
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [token]);

  return (
    <span
      aria-live="polite"
      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
    >
      {message}
    </span>
  );
}

// The control itself, sized and tinted to sit beside the back chevron and the bug/gear cluster in an
// admin top bar. Renders nothing when there is no provider above it, so dropping it into a shell
// that is also used outside /admin is harmless.
export function AdminRefreshControl({ accent = '#6366F1' }: { accent?: string }) {
  const ctx = useAdminRefresh();
  if (!ctx) return null;

  const { refresh, pending } = ctx;

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={pending}
      aria-label="Refresh this screen"
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
      <RefreshCw size={18} aria-hidden="true" className={pending ? 'ctf-spin' : undefined} />
    </button>
  );
}
