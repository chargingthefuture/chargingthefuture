import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { authedFetchJson } from './authedFetch';
import { reportError } from '../observability/report';

/**
 * The username and admin flag the server holds for the signed-in member.
 *
 * The app signs in through Clerk's OAuth flow, and that id_token carries neither the username nor the
 * role the web session token carries. Read from the token alone, an admin gets no Admin pill and every
 * handle falls back to a short id ("user-user_361"). The server reads both from the member's Clerk
 * account (web lib/auth/verify-bearer.ts), so the app asks it once per sign-in.
 */
export type ServerIdentity = { userId: string; username: string | null; isAdmin: boolean };

type IdentityResponse = { ok?: boolean; userId?: unknown; username?: unknown; isAdmin?: unknown };

async function fetchServerIdentity(): Promise<ServerIdentity | null> {
  const body = await authedFetchJson<IdentityResponse>('/api/account/identity');
  if (typeof body.userId !== 'string') return null;
  return {
    userId: body.userId,
    username: typeof body.username === 'string' && body.username.length > 0 ? body.username : null,
    isAdmin: body.isAdmin === true,
  };
}

// How often a failed read is tried again before waiting for the app to come back to the foreground.
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000];

// Reads the identity whenever the signed-in subject changes, and again each time the app comes back to
// the foreground, so a role granted later, or a first read that failed (no signal, the server waking
// up), reaches the app without signing out. A failed read is tried again a few times; until one
// answers, the token's own values stay in place, so the app still works, only without the admin pages
// or the handle. Null while signed out or until the first answer.
export function useServerIdentity(subject: string | null): ServerIdentity | null {
  const [identity, setIdentity] = useState<ServerIdentity | null>(null);
  useEffect(() => {
    setIdentity(null);
    if (!subject) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    const read = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      fetchServerIdentity().then(
        (next) => {
          attempt = 0;
          if (active && next && next.userId === subject) setIdentity(next);
        },
        (caught: unknown) => {
          reportError(caught, { area: 'auth', op: 'server_identity', extra: { attempt } });
          const delay = RETRY_DELAYS_MS[attempt];
          attempt += 1;
          if (active && delay !== undefined) timer = setTimeout(read, delay);
        },
      );
    };
    read();
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      attempt = 0;
      read();
    });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [subject]);
  return identity;
}
