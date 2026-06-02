import { cookies, headers } from 'next/headers';
import { authenticatePluginUser, type AuthProvider } from '@ctf/shared';

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
  isApproved: boolean;
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

  const userId = readIdentityValue('x-ctf-user-id', 'ctf_user_id', headerStore, cookieStore);
  const authProviderRaw = readIdentityValue('x-ctf-auth-provider', 'ctf_auth_provider', headerStore, cookieStore);
  const token = readIdentityValue('authorization', 'ctf_token', headerStore, cookieStore);
  const provider = (authProviderRaw as AuthProvider) || 'custom';

  // Delegate to canonical generic auth logic
  const authResult = await authenticatePluginUser({
    provider,
    token: token || undefined,
    userId: userId || undefined,
  });

  const explicitAuthenticationState = normalizeBoolean(
    readIdentityValue('x-ctf-authenticated', 'ctf_authenticated', headerStore, cookieStore),
  );
  const isAuthenticated = explicitAuthenticationState ?? authResult.isAuthenticated;
  const username = readIdentityValue('x-ctf-username', 'ctf_username', headerStore, cookieStore);
  const firstName = readIdentityValue('x-ctf-first-name', 'ctf_first_name', headerStore, cookieStore);
  const lastName = readIdentityValue('x-ctf-last-name', 'ctf_last_name', headerStore, cookieStore);
  const role = normalizeRole(
    readIdentityValue('x-ctf-user-role', 'ctf_user_role', headerStore, cookieStore),
  );
  const isApproved = normalizeBoolean(
    readIdentityValue('x-ctf-user-approved', 'ctf_user_approved', headerStore, cookieStore),
  ) ?? isAuthenticated;

  return {
    isAuthenticated,
    authProvider: provider,
    userId: isAuthenticated ? authResult.userId || userId : null,
    username: isAuthenticated ? username : null,
    firstName: isAuthenticated ? firstName : null,
    lastName: isAuthenticated ? lastName : null,
    role: isAuthenticated ? role : null,
    isAdmin: isAuthenticated ? role === 'admin' : false,
    isApproved: isAuthenticated ? isApproved : false,
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
