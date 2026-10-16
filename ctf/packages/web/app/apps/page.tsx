import { redirect } from 'next/navigation';
import { CommunityShell } from '../../components/community-shell/community-shell';
import type { ShellCurrentUser } from '../../components/community-shell/shell-types';
import type { TrustUserExtension } from '../../lib/trust/types';
import { evaluatePluginAccess } from '../../lib/auth/server-authz';
import { getGdpShellStats } from '../../lib/gdp/repository';
import { listPluginRegistry, filterPluginsForViewer } from '../../lib/plugins/repository';
import { readTrustSelfExtensionOrStored } from '../../lib/trust/repository';
import { getHostedSignInUrl } from '../../lib/auth/provider-env';
import { reportError } from '../../lib/observability/report';

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

type AccessDecision = Awaited<ReturnType<typeof evaluatePluginAccess>> | null;

/**
 * Who the launcher is showing, from the access check. Split out of AppsPage to keep it inside the
 * complexity budget (rule 116).
 *
 * A signed-in member the gate turns away (not yet approved in Unlock, or a restricted account) is
 * sent to the home page, which already routes them: into Unlock, to the Commons stripped back to the
 * verification banner, or to /account-closed (owner decision, 2026-10-16; issue #2772). Rendering the
 * launcher here instead showed them the signed-out screen with Sign In buttons. Only a signed-out
 * visitor (401), or a failed check, sees the public launcher.
 *
 * Operator-only plugins (e.g. Weekly Performance) are kept out of the launcher unless the viewer is
 * an admin; the matching /apps/<slug> route is admin-gated too, so that is UX, not the security
 * boundary.
 */
function resolveViewer(authDecision: AccessDecision): {
  allowedUserId: string | null;
  currentUser: ShellCurrentUser;
  isAuthenticated: boolean;
  isAdmin: boolean;
} {
  if (authDecision && !authDecision.allowed && authDecision.status === 403) {
    redirect('/');
  }
  if (authDecision && authDecision.allowed) {
    return {
      allowedUserId: authDecision.userId,
      currentUser: buildShellUser(authDecision.userId, authDecision.username),
      isAuthenticated: true,
      isAdmin: Boolean(authDecision.isAdmin),
    };
  }
  return { allowedUserId: null, currentUser: buildShellUser('guest', null), isAuthenticated: false, isAdmin: false };
}

export default async function AppsPage() {
  const pluginsPromise = listPluginRegistry();
  const shellStatsPromise = getGdpShellStats().catch(() => ({ memberCount: null, gdpValueUsd: null }));
  const authDecisionPromise = evaluatePluginAccess({ requireUsername: false }).catch((error: unknown) => {
    // Renders the signed-out launcher; report it so an access-check outage is not silent.
    reportError(error, { area: 'apps', op: 'access_check' });
    return null;
  });

  const [plugins, shellStats, authDecision] = await Promise.all([
    pluginsPromise,
    shellStatsPromise,
    authDecisionPromise,
  ]);

  const viewer = resolveViewer(authDecision);
  const visiblePlugins = filterPluginsForViewer(plugins, viewer.isAdmin);
  const trust = viewer.allowedUserId
    ? await readTrustSelfExtensionOrStored(viewer.allowedUserId).catch(() => buildFallbackTrust(viewer.allowedUserId as string))
    : buildFallbackTrust(viewer.currentUser.userId);

  const signInUrl = getHostedSignInUrl() ?? '/';

  return (
    <CommunityShell
      initialPlugins={visiblePlugins}
      shellStats={shellStats}
      currentUser={viewer.currentUser}
      trust={trust}
      isAuthenticated={viewer.isAuthenticated}
      isAdmin={viewer.isAdmin}
      signInUrl={signInUrl}
      initialSection="apps"
    />
  );
}
