import { cookies, headers } from 'next/headers';
import type { UnlockAccessTier } from 'lib/unlock/types';
import { authenticatePluginUser, type AuthProvider } from '@ctf/shared';

type MaybeValue = string | null | undefined;

export type RequestIdentity = {
  isAuthenticated: boolean;
  authProvider: string | null;
  userId: string | null;
  username: string | null;
  role: string | null;
  isAdmin: boolean;
  isApproved: boolean;
  unlockAccessTier: UnlockAccessTier | null;
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

function normalizeUnlockAccessTier(value: MaybeValue): UnlockAccessTier | null {
  const normalized = pickFirstNonEmpty(value);
  if (
    normalized === 'pending_readonly'
    || normalized === 'locked_support_only'
    || normalized === 'approved_full'
  ) {
    return normalized;
  }

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
  const role = normalizeRole(
    readIdentityValue('x-ctf-user-role', 'ctf_user_role', headerStore, cookieStore),
  );
  const isApproved = normalizeBoolean(
    readIdentityValue('x-ctf-user-approved', 'ctf_user_approved', headerStore, cookieStore),
  ) ?? isAuthenticated;
  const unlockAccessTier = normalizeUnlockAccessTier(
    readIdentityValue('x-ctf-unlock-tier', 'ctf_unlock_tier', headerStore, cookieStore),
  );

  return {
    isAuthenticated,
    authProvider: provider,
    userId: isAuthenticated ? authResult.userId || userId : null,
    username: isAuthenticated ? username : null,
    role: isAuthenticated ? role : null,
    isAdmin: isAuthenticated ? role === 'admin' : false,
    isApproved: isAuthenticated ? isApproved : false,
    unlockAccessTier: isAuthenticated ? unlockAccessTier : null,
  };
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
