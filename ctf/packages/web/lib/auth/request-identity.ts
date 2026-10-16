import { headers } from 'next/headers';
import { recordLoginEvent } from 'lib/engagement/login-activity';
import { hasValidIdentityStamp } from './identity-stamp';
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

// Record that this member turned up today. Signing in is a Clerk event and has nothing to do with
// which plugin gets opened next, so the recording belongs here — the one place every authenticated
// request resolves its Clerk identity, whether it arrived as a verified web session or a verified
// bearer token. It used to hang off `evaluatePluginAccess` instead, so a member's day went
// unrecorded unless a plugin access check happened to run on that request: a sign-in that reached
// only an SSR page or a route using the identity layer directly counted as nobody turning up
// (owner decision, 2026-08-27).
//
// Fire-and-forget and deduplicated to one row per member per UTC day, so putting it on this path
// costs a set lookup per request rather than a write; see lib/engagement/login-activity.ts.
function recordSignIn(userId: string | null): void {
  if (userId) {
    recordLoginEvent(userId);
  }
}

async function isMiddlewareAuthenticated(headerStore: Headers): Promise<boolean> {
  return (
    normalizeBoolean(headerStore.get('x-ctf-authenticated')) === true &&
    pickFirstNonEmpty(headerStore.get('x-ctf-user-id')) !== null &&
    (await hasValidIdentityStamp(headerStore))
  );
}

const SIGNED_OUT: RequestIdentity = {
  isAuthenticated: false,
  authProvider: 'clerk',
  userId: null,
  username: null,
  firstName: null,
  lastName: null,
  role: null,
  isAdmin: false,
};

// External API client path (the mobile app): the request carries an `Authorization: Bearer <token>`.
// The token is CRYPTOGRAPHICALLY verified with Clerk's server SDK and identity comes ONLY from the
// verified claims, filled from the subject's own Clerk account where the token is silent. Spoofable
// `x-ctf-user-*` headers are never read on this path, so an external caller cannot forge an identity.
async function resolveBearerIdentity(authorization: string): Promise<RequestIdentity | null> {
  const verified = await verifyBearerIdentity(authorization);
  if (!verified) return null;
  const role = verified.role ? verified.role.toLowerCase() : null;
  recordSignIn(verified.userId);
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

// The web Clerk middleware is the ONLY thing allowed to set the managed `x-ctf-*` identity headers:
// it strips whatever the client sent and rewrites them from the verified Clerk session, marking the
// request with `x-ctf-authenticated`. So a same-origin web request (SSR/route handler) is already
// trusted here. We only read the `x-ctf-user-*` identity headers when the middleware confirmed
// authentication (`x-ctf-authenticated === 'true'`) and stamped the request (see identity-stamp.ts:
// the middleware's matcher skips paths that look like static files, and on those a client-sent
// header would arrive untouched). Headers only: a header the middleware left unset (no role or
// username claim) means the value is absent, never a cookie, since cookies are written by the client.
function middlewareIdentity(headerStore: Headers): RequestIdentity {
  const userId = pickFirstNonEmpty(headerStore.get('x-ctf-user-id'));
  const role = normalizeRole(headerStore.get('x-ctf-user-role'));
  recordSignIn(userId);
  return {
    isAuthenticated: true,
    authProvider: 'clerk',
    userId,
    username: pickFirstNonEmpty(headerStore.get('x-ctf-username')),
    firstName: pickFirstNonEmpty(headerStore.get('x-ctf-first-name')),
    lastName: pickFirstNonEmpty(headerStore.get('x-ctf-last-name')),
    role,
    isAdmin: role === 'admin',
  };
}

export async function resolveRequestIdentity(): Promise<RequestIdentity> {
  const headerStore = await headers();

  // A bearer token is verified here before the middleware's headers are read. Clerk's middleware
  // accepts the Android app's sign-in token (an OAuth id_token) as a session token too, and that
  // token carries no role or username, so trusting the middleware's headers for it made every admin
  // a member on Android: no Admin pill and no admin screens. The bearer path fills both from the
  // member's Clerk account. The web sends no bearer header, so a web session is unchanged.
  const authorization = headerStore.get('authorization');
  if (authorization) {
    const bearer = await resolveBearerIdentity(authorization);
    if (bearer) return bearer;
  }

  if (await isMiddlewareAuthenticated(headerStore)) {
    return middlewareIdentity(headerStore);
  }

  return { ...SIGNED_OUT };
}

// Lightweight: read only the request's user id from the middleware's headers, for
// per-user feature-flag targeting (e.g. demo-mode). Unlike resolveRequestIdentity it
// does NOT verify a bearer token (no JWT, no DB); the stamp check is one cached digest
// comparison, so it is safe on hot paths like DB-pool selection. Returns null for a
// signed-out or unstamped request, and outside a request scope (seed scripts,
// migrations) where headers() is unavailable.
export async function getRequestUserId(): Promise<string | null> {
  let headerStore: Headers;
  try {
    headerStore = await headers();
  } catch {
    return null;
  }
  if (!(await isMiddlewareAuthenticated(headerStore))) {
    return null;
  }
  return pickFirstNonEmpty(headerStore.get('x-ctf-user-id'));
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
