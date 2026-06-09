import { redirect } from 'next/navigation';
import { CommunityShell } from '../components/community-shell/community-shell';
import type { ShellCurrentUser } from '../components/community-shell/shell-types';
import type { TrustUserExtension } from '../lib/trust/types';
import { resolveRequestIdentity } from '../lib/auth/request-identity';
import { getUnlockAccessTier } from '../lib/unlock/access';
import { getGdpShellStats } from '../lib/gdp/repository';
import { listPluginRegistry } from '../lib/plugins/repository';
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
    trustStatus: 'unverified',
    trustEvidence: [],
    trustVisibility: 'public',
    updatedAt: new Date().toISOString(),
  };
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

  const userId = identity?.isAuthenticated ? identity.userId : null;
  const isAdmin = identity?.isAdmin ?? false;

  // Unlock is the single source of truth for how much of the Hub a signed-in member sees.
  // Resolve the tier once and branch:
  //   - not signed in            -> anonymous shell (sign-in prompt)
  //   - admin OR approved_full   -> full shell
  //   - locked_support_only      -> restricted shell (general channel only)
  //   - pending_readonly / none  -> redirect into the Unlock flow
  const tier = userId ? await getUnlockAccessTier(userId).catch(() => null) : null;

  if (userId && !isAdmin && tier !== 'approved_full' && tier !== 'locked_support_only') {
    redirect('/plugin/unlock');
  }

  const isAuthenticated = Boolean(userId);
  const accessTier: 'approved_full' | 'support_only' =
    tier === 'locked_support_only' && !isAdmin ? 'support_only' : 'approved_full';

  const currentUser = userId
    ? buildShellUser(userId, identity?.username ?? null)
    : buildShellUser('guest', null);

  const trust = userId
    ? await getTrustUserExtension(userId).catch(() => buildFallbackTrust(userId))
    : buildFallbackTrust(currentUser.userId);

  // Send "Sign In" straight to Clerk's hosted Account Portal. Falls back to the
  // in-app `/sign-in` catch-all (which itself forwards to the portal) only when
  // no hosted URL can be resolved.
  const signInUrl = getHostedSignInUrl() ?? '/sign-in';

  return (
    <CommunityShell
      initialPlugins={plugins}
      shellStats={shellStats}
      currentUser={currentUser}
      trust={trust}
      isAuthenticated={isAuthenticated}
      accessTier={accessTier}
      signInUrl={signInUrl}
    />
  );
}
