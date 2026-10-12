import { useEffect, useState } from 'react';
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

// Reads the identity whenever the signed-in subject changes; null while signed out or until it answers.
// A failed read leaves the token's own values in place, so the app still works, only without the admin
// pages or the handle.
export function useServerIdentity(subject: string | null): ServerIdentity | null {
  const [identity, setIdentity] = useState<ServerIdentity | null>(null);
  useEffect(() => {
    setIdentity(null);
    if (!subject) return;
    let active = true;
    fetchServerIdentity().then(
      (next) => {
        if (active && next && next.userId === subject) setIdentity(next);
      },
      (caught: unknown) => reportError(caught, { area: 'auth', op: 'server_identity' }),
    );
    return () => {
      active = false;
    };
  }, [subject]);
  return identity;
}
