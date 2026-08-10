import { redirect } from 'next/navigation';
import { CommunityShell, type ShellVerification } from '../components/community-shell/community-shell';
import type { ShellCurrentUser } from '../components/community-shell/shell-types';
import type { TrustUserExtension } from '../lib/trust/types';
import { resolveRequestIdentity, type RequestIdentity } from '../lib/auth/request-identity';
import { getUnlockAccessTier, isUnlockEarlyCommonsEnabled } from '../lib/unlock/access';
import { getUnlockStatusForUser } from '../lib/unlock/repository';
import type { UnlockAccessTier } from '../lib/unlock/types';
import { getGdpShellStats } from '../lib/gdp/repository';
import { listPluginRegistry, filterPluginsForViewer } from '../lib/plugins/repository';
import { getTrustUserExtension } from '../lib/trust/repository';
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

// A/B experiment: a not-yet-verified member in the early-Commons treatment bucket lands on the
// Commons (the Hub) instead of being redirected to the Unlock screen, so they can ask for help —
// e.g. trouble finding their Quora URL. Only evaluated for users who would otherwise be redirected,
// and defaults to false (control), so production routing is unchanged until the rollout is enabled.
async function resolveEarlyCommons(
  userId: string | null,
  tier: UnlockAccessTier | null,
): Promise<boolean> {
  if (!userId) {
    return false;
  }
  if (tier === 'approved_full' || tier === 'locked_support_only') {
    return false;
  }
  return isUnlockEarlyCommonsEnabled(userId).catch(() => false);
}

// Unlock is the single source of truth for who reaches the Hub. Everyone else is redirected into
// the Unlock flow. Admins and approved_full/locked_support_only members reach the Hub; an
// early-Commons treatment member is also allowed to stay.
function shouldRedirectToUnlock(params: {
  userId: string | null;
  isAdmin: boolean;
  tier: UnlockAccessTier | null;
  earlyCommons: boolean;
}): boolean {
  const { userId, isAdmin, tier, earlyCommons } = params;
  return (
    Boolean(userId) &&
    !isAdmin &&
    tier !== 'approved_full' &&
    tier !== 'locked_support_only' &&
    !earlyCommons
  );
}

// Early-Commons treatment members land on the Commons instead of the Unlock screen, so without a
// prompt here they have no idea verification is still required. Give them a persistent verify prompt
// in the shell to submit their Quora URL. Scoped to the treatment bucket only: submitting moves a
// member to `pending_readonly`, and only a treatment member stays on the Commons afterward (a
// support-only member would be redirected to /plugin/unlock), so we do not prompt support-only
// members here and create that trap.
async function resolveVerification(
  earlyCommons: boolean,
  userId: string | null,
): Promise<ShellVerification | null> {
  if (!earlyCommons || !userId) {
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
  return getTrustUserExtension(userId).catch(() => buildFallbackTrust(userId));
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
  const tier = userId ? await getUnlockAccessTier(userId).catch(() => null) : null;

  const earlyCommons = await resolveEarlyCommons(userId, tier);

  if (shouldRedirectToUnlock({ userId, isAdmin, tier, earlyCommons })) {
    redirect('/plugin/unlock');
  }

  const verification = await resolveVerification(earlyCommons, userId);

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
