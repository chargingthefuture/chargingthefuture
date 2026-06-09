import { cookies, headers } from 'next/headers';
import { verifyBearerIdentity } from './verify-bearer';

type MaybeValue = string | null | undefined;

export type RequestIdentity = {
  isAuthenticated: boolean;
  authProvider: string | null;
  userId: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  isAdmin: boolean;
};

function pickFirstNonEmpty(...values: MaybeValue[]): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return null;
}

function normalizeRole(value: MaybeValue): string | null {
  const normalized = pickFirstNonEmpty(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeBoolean(value: MaybeValue): boolean | null {
  const normalized = pickFirstNonEmpty(value)?.toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'yes', 'approved'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'denied'].includes(normalized)) return false;
  return null;
}

function readIdentityValue(
  headerName: string,
  cookieName: string,
  headerStore: Headers,
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): string | null {
  return pickFirstNonEmpty(
    headerStore.get(headerName),
    cookieStore.get(cookieName)?.value,
  );
}

export async function resolveRequestIdentity(): Promise<RequestIdentity> {
  const headerStore = await headers();
  const cookieStore = await cookies();

  // The web Clerk middleware is the ONLY thing allowed to set the managed
  // `x-ctf-*` identity headers: it strips whatever the client sent and rewrites
  // them from the verified Clerk session, marking the request with
  // `x-ctf-authenticated`. So a same-origin web request (SSR/route handler) is
  // already trusted here. We only read the `x-ctf-user-*` identity headers when
  // the middleware confirmed authentication (`x-ctf-authenticated === 'true'`).
  const middlewareAuthenticated =
    normalizeBoolean(headerStore.get('x-ctf-authenticated')) === true &&
    pickFirstNonEmpty(headerStore.get('x-ctf-user-id')) !== null;

  if (middlewareAuthenticated) {
    const userId = readIdentityValue('x-ctf-user-id', 'ctf_user_id', headerStore, cookieStore);
    const username = readIdentityValue('x-ctf-username', 'ctf_username', headerStore, cookieStore);
    const firstName = readIdentityValue('x-ctf-first-name', 'ctf_first_name', headerStore, cookieStore);
    const lastName = readIdentityValue('x-ctf-last-name', 'ctf_last_name', headerStore, cookieStore);
    const role = normalizeRole(
      readIdentityValue('x-ctf-user-role', 'ctf_user_role', headerStore, cookieStore),
    );

    return {
      isAuthenticated: true,
      authProvider: 'clerk',
      userId,
      username,
      firstName,
      lastName,
      role,
      isAdmin: role === 'admin',
    };
  }

  // External API client path (e.g. the mobile app): the request carries an
  // `Authorization: Bearer <clerk session token>`. We CRYPTOGRAPHICALLY verify
  // that token with Clerk's server SDK and derive identity ONLY from the verified
  // claims. Spoofable `x-ctf-user-*` headers are never read on this path, so an
  // external caller cannot forge an identity.
  const verified = await verifyBearerIdentity(headerStore.get('authorization'));
  if (verified) {
    const role = verified.role ? verified.role.toLowerCase() : null;
    return {
      isAuthenticated: true,
      authProvider: 'clerk',
      userId: verified.userId,
      username: verified.username,
      firstName: verified.firstName,
      lastName: verified.lastName,
      role,
      isAdmin: role === 'admin',
    };
  }

  // Unauthenticated.
  return {
    isAuthenticated: false,
    authProvider: 'clerk',
    userId: null,
    username: null,
    firstName: null,
    lastName: null,
    role: null,
    isAdmin: false,
  };
}

// Lightweight: read only the request's user id from headers/cookies, for per-user
// feature-flag targeting (e.g. demo-mode). Unlike resolveRequestIdentity it does NOT
// verify the token (no JWT/crypto, no DB), so it is safe on hot paths like DB-pool
// selection. Returns null outside a request scope (seed scripts, migrations) where
// headers()/cookies() are unavailable.
export async function getRequestUserId(): Promise<string | null> {
  try {
    const headerStore = await headers();
    const cookieStore = await cookies();
    return readIdentityValue('x-ctf-user-id', 'ctf_user_id', headerStore, cookieStore);
  } catch {
    return null;
  }
}

export function buildIdentityDisplayName(username: string | null, userId: string | null): string {
  if (username) {
    return `@${username}`;
  }

  if (!userId) {
    return 'Guest';
  }

  return `user-${userId.slice(0, 8)}`;
}

// Render a person's name for surfaces that lead with the real name (e.g. the
// Directory): "First Last", or just whichever of the two is present. Falls back
// to `@username` and finally to the anonymous identity, so the value is never
// empty. Pure — safe to import on the client.
export function buildPersonName(
  firstName: string | null,
  lastName: string | null,
  username: string | null,
  userId: string | null = null,
): string {
  const parts = [firstName, lastName]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part.length > 0);

  if (parts.length > 0) {
    return parts.join(' ');
  }

  return buildIdentityDisplayName(username, userId);
}
