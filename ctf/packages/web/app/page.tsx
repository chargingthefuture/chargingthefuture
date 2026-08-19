import { redirect } from 'next/navigation';
import { CommunityShell, type ShellVerification } from '../components/community-shell/community-shell';
import type { ShellCurrentUser } from '../components/community-shell/shell-types';
import type { TrustUserExtension } from '../lib/trust/types';
import { resolveRequestIdentity, type RequestIdentity } from '../lib/auth/request-identity';
import { getUnlockAccessTier } from '../lib/unlock/access';
import { getAccountRestrictionStatus } from '../lib/auth/account-restrictions';
import { getUnlockStatusForUser } from '../lib/unlock/repository';
import type { UnlockAccessTier } from '../lib/unlock/types';
import { getGdpShellStats } from '../lib/gdp/repository';
import { listPluginRegistry, filterPluginsForViewer } from '../lib/plugins/repository';
import { readTrustSelfExtensionOrStored } from '../lib/trust/repository';
import { getHostedSignInUrl } from '../lib/auth/provider-env';

function buildShellUser(userId: string, username: string | null): ShellCurrentUser {
  const safeUsername = username && username !== 'guest' ? username : null;
  const displayName = safeUsername ? `@${safeUsername}` : 'Survivor';
  const initial = safeUsername ? safeUsername.charAt(0).toUpperCase() : 'S';

  return {
    userId,
    username: safeUsername,
    displayName,
    initial,
  };
}

function buildFallbackTrust(userId: string): TrustUserExtension {
  return {
    userId,
    trustEvidence: [],
    updatedAt: new Date().toISOString(),
  };
}

// Reduce a resolved request identity to the two fields the hub branches on.
// A guest (unauthenticated) resolves to a null userId and non-admin.
function resolveIdentityFields(identity: RequestIdentity | null): {
  userId: string | null;
  isAdmin: boolean;
} {
  const userId = identity?.isAuthenticated ? identity.userId : null;
  const isAdmin = identity?.isAdmin ?? false;
  return { userId, isAdmin };
}

// Unlock is the single source of truth for who reaches the Hub. Everyone else is redirected into the
// Unlock flow. Admins and approved_full/locked_support_only members reach the Hub — and a member who
// asked for help, or who has been here on an earlier day, now resolves to locked_support_only in
// getUnlockAccessTier, so they are covered by the same clause rather than by a branch of their own.
function shouldRedirectToUnlock(params: {
  userId: string | null;
  isAdmin: boolean;
  tier: UnlockAccessTier | null;
}): boolean {
  const { userId, isAdmin, tier } = params;
  return (
    Boolean(userId) && !isAdmin && tier !== 'approved_full' && tier !== 'locked_support_only'
  );
}

// A member on the Commons who is not yet fully verified gets a persistent prompt above the chat to
// submit their Quora URL — without it they see the chat with nothing telling them verification is
// still required, which is the bug this banner was added for. Shown for every non-approved member
// here, not a subset: someone who asked for help needs the ask kept in front of them, someone whose
// submission was rejected needs the chance to correct it, and someone awaiting review gets a calm
// "under review" note from the banner itself. An approved member sees nothing.
async function resolveVerification(
  tier: UnlockAccessTier | null,
  userId: string | null,
): Promise<ShellVerification | null> {
  if (!userId || tier === 'approved_full') {
    return null;
  }
  const unlockStatus = await getUnlockStatusForUser(userId).catch(() => null);
  if (!unlockStatus) {
    return null;
  }
  return {
    hasSubmission: unlockStatus.hasSubmission,
    reviewStatus: unlockStatus.reviewStatus,
  };
}

async function resolveTrust(
  userId: string | null,
  fallbackUserId: string,
): Promise<TrustUserExtension> {
  if (!userId) {
    return buildFallbackTrust(fallbackUserId);
  }
  // Recomputes on the shared throttle rather than reading whatever was last written, so the card
  // here agrees with the account hub instead of showing an older snapshot of the same member.
  return readTrustSelfExtensionOrStored(userId).catch(() => buildFallbackTrust(userId));
}

export default async function HomePage() {
  const pluginsPromise = listPluginRegistry();
  const shellStatsPromise = getGdpShellStats().catch(() => ({ memberCount: null, gdpValueUsd: null }));
  const identityPromise = resolveRequestIdentity().catch(() => null);

  const [plugins, shellStats, identity] = await Promise.all([
    pluginsPromise,
    shellStatsPromise,
    identityPromise,
  ]);

  const { userId, isAdmin } = resolveIdentityFields(identity);

  // Operator-only plugins (e.g. Weekly Performance) must not appear in the member hub's app list.
  // The /apps launcher and /api/plugins already apply this filter; the home hub did not, so an
  // admin-only tile leaked to members here. Admins still see the full list. The plugin's own route
  // is separately gated, so this only hides the tile.
  const visiblePlugins = filterPluginsForViewer(plugins, isAdmin);

  // Unlock is the single source of truth for who reaches the Hub. Resolve the tier once and branch:
  //   - not signed in                         -> anonymous shell (sign-in prompt)
  //   - admin / approved_full / support_only  -> the normal Hub
  //   - pending_readonly / none               -> redirect into the Unlock flow
  // A support_only member sees the same Hub as everyone else; the general channel is their
  // support surface, and tapping a plugin they cannot use yet shows that plugin's public
  // landing page (handled at the plugin route), not a denial wall. Nothing is hidden here.
  // A closed account (spam or duplicate) still has a stored access tier, so without this check it would
  // pass the tier branch below and land on a Commons where every call answers 403 — the app looking
  // broken instead of saying a decision was made. Send them to the page that explains it and offers the
  // one thing they can still do: sign in as their other account, or delete this identity.
  if (userId && !isAdmin) {
    const restriction = await getAccountRestrictionStatus(userId, 'all').catch(() => ({ isRestricted: false }));
    if (restriction.isRestricted) {
      redirect('/account-closed');
    }
  }

  const tier = userId ? await getUnlockAccessTier(userId).catch(() => null) : null;

  if (shouldRedirectToUnlock({ userId, isAdmin, tier })) {
    redirect('/plugin/unlock');
  }

  const verification = await resolveVerification(tier, userId);

  const isAuthenticated = Boolean(userId);

  const currentUser = userId
    ? buildShellUser(userId, identity?.username ?? null)
    : buildShellUser('guest', null);

  const trust = await resolveTrust(userId, currentUser.userId);

  // Send "Sign In" straight to Clerk's hosted Account Portal. Falls back to the
  // in-app `/sign-in` catch-all (which itself forwards to the portal) only when
  // no hosted URL can be resolved.
  const signInUrl = getHostedSignInUrl() ?? '/sign-in';

  return (
    <CommunityShell
      initialPlugins={visiblePlugins}
      shellStats={shellStats}
      currentUser={currentUser}
      trust={trust}
      isAuthenticated={isAuthenticated}
      isAdmin={isAdmin}
      signInUrl={signInUrl}
      verification={verification}
    />
  );
}
