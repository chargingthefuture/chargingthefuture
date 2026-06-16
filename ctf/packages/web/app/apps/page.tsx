import { CommunityShell } from '../../components/community-shell/community-shell';
import type { ShellCurrentUser } from '../../components/community-shell/shell-types';
import type { TrustUserExtension } from '../../lib/trust/types';
import { evaluatePluginAccess } from '../../lib/auth/server-authz';
import { getGdpShellStats } from '../../lib/gdp/repository';
import { listPluginRegistry, filterPluginsForViewer } from '../../lib/plugins/repository';
import { getTrustUserExtension } from '../../lib/trust/repository';

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

export default async function AppsPage() {
  const pluginsPromise = listPluginRegistry();
  const shellStatsPromise = getGdpShellStats().catch(() => ({ memberCount: null, gdpValueUsd: null }));
  const authDecisionPromise = evaluatePluginAccess({ requireUsername: false }).catch(() => null);

  const [plugins, shellStats, authDecision] = await Promise.all([
    pluginsPromise,
    shellStatsPromise,
    authDecisionPromise,
  ]);

  // Operator-only plugins (e.g. Weekly Performance) are kept out of the user launcher unless the
  // viewer is an admin. The matching /apps/<slug> route is admin-gated too, so this is UX, not the
  // security boundary.
  const isAdmin = !!(authDecision && authDecision.allowed && authDecision.isAdmin);
  const visiblePlugins = filterPluginsForViewer(plugins, isAdmin);

  const currentUser = authDecision && authDecision.allowed
    ? buildShellUser(authDecision.userId, authDecision.username)
    : buildShellUser('guest', null);

  const trust = authDecision && authDecision.allowed
    ? await getTrustUserExtension(authDecision.userId).catch(() => buildFallbackTrust(authDecision.userId))
    : buildFallbackTrust(currentUser.userId);

  return (
    <CommunityShell
      initialPlugins={visiblePlugins}
      shellStats={shellStats}
      currentUser={currentUser}
      trust={trust}
      initialSection="apps"
    />
  );
}
