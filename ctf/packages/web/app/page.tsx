import { CommunityShell } from '../components/community-shell/community-shell';
import type { ShellCurrentUser } from '../components/community-shell/shell-types';
import type { TrustUserExtension } from '../lib/trust/types';
import { evaluatePluginAccess } from '../lib/auth/server-authz';
import { getGdpShellStats } from '../lib/gdp/repository';
import { listPluginRegistry } from '../lib/plugins/repository';
import { getTrustUserExtension } from '../lib/trust/repository';
import { getConfiguredAuthProvider } from '../lib/auth/provider-env';

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
  const authDecisionPromise = evaluatePluginAccess({ requireUsername: false }).catch(() => null);

  const [plugins, shellStats, authDecision] = await Promise.all([
    pluginsPromise,
    shellStatsPromise,
    authDecisionPromise,
  ]);

  const allowDecision = authDecision?.allowed ? authDecision : null;
  const isAuthenticated = Boolean(allowDecision);
  const currentUser = allowDecision
    ? buildShellUser(allowDecision.userId, allowDecision.username)
    : buildShellUser('guest', null);

  const trust = allowDecision
    ? await getTrustUserExtension(allowDecision.userId).catch(() => buildFallbackTrust(allowDecision.userId))
    : buildFallbackTrust(currentUser.userId);

  const authProvider = getConfiguredAuthProvider();
  const signInUrl = authProvider?.signInUrl || '/sign-in';

  return (
    <CommunityShell
      initialPlugins={plugins}
      shellStats={shellStats}
      currentUser={currentUser}
      trust={trust}
      isAuthenticated={isAuthenticated}
      signInUrl={signInUrl}
    />
  );
}
