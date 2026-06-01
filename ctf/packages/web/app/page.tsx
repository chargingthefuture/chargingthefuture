import { redirect } from 'next/navigation';
import { CommunityShell } from '../components/community-shell/community-shell';
import type { ShellCurrentUser } from '../components/community-shell/shell-types';
import type { TrustUserExtension } from '../lib/trust/types';
import { evaluatePluginAccess } from '../lib/auth/server-authz';
import { getGdpShellStats } from '../lib/gdp/repository';
import { listPluginRegistry } from '../lib/plugins/repository';
import { getTrustUserExtension } from '../lib/trust/repository';
import { getHostedSignInUrl } from '../lib/auth/provider-env';
import { isDemoMode } from '../lib/feature-flags/system';

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
  // The chat suggestion chips are unfinished; show them only to demo-mode users
  // ("stage") and hide them in production. Defaults to hidden on any failure.
  const demoModePromise = isDemoMode().catch(() => false);

  const [plugins, shellStats, authDecision, demoMode] = await Promise.all([
    pluginsPromise,
    shellStatsPromise,
    authDecisionPromise,
    demoModePromise,
  ]);

  // `evaluatePluginAccess` denies an anonymous visitor with 401 (AUTH_UNAUTHORIZED)
  // and a signed-in-but-not-yet-unlocked user with 403. Forward the signed-in
  // case to the hosted unlock/verification flow so a logged-in member is never
  // shown the anonymous "please sign in" shell — which previously made signing in
  // look like it did nothing.
  if (authDecision && !authDecision.allowed && authDecision.code !== 'AUTH_UNAUTHORIZED') {
    redirect('/plugin/unlock');
  }

  const allowDecision = authDecision?.allowed ? authDecision : null;
  const isAuthenticated = Boolean(allowDecision);
  const currentUser = allowDecision
    ? buildShellUser(allowDecision.userId, allowDecision.username)
    : buildShellUser('guest', null);

  const trust = allowDecision
    ? await getTrustUserExtension(allowDecision.userId).catch(() => buildFallbackTrust(allowDecision.userId))
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
      signInUrl={signInUrl}
      showChatSuggestions={demoMode}
    />
  );
}
