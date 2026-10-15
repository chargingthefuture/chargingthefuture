import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import type { PluginAuthDecision } from 'lib/auth/server-authz';
import { getHostedSignInUrl, withSignInReturn } from 'lib/auth/provider-env';
import { normalizeInviteHandle } from 'lib/directory/invite-input';
import { DirectoryPublicShell } from './directory-public-shell';
import { DirectoryInviteWall } from './directory-invite-wall';

// What /apps/directory shows before the Directory itself (owner decision, 2026-10-15). The page gate
// stays at full Unlock approval; this only decides what a viewer it turns away sees instead.
//  - signed out: the count, the ask to sign in, the invitations already published on the blog in
//    the open, and the private ones as a blurred wall of cards;
//  - signed in but not approved: the invitations in full (their gate is lib/directory/invite-access.ts,
//    and the API routes enforce it) with the ask to finish the check;
//  - approved, following a link to one invitation: that invitation on the wall.
// Returns null when the normal path applies: an approved member with no ?invite=, or a denial of
// another kind, which keeps the shared access-denied handling.
export function renderDirectoryEntry(
  decision: PluginAuthDecision,
  query: { invite?: string; page?: string },
  returnPath: string,
): ReactNode | null {
  const handle = normalizeInviteHandle(query.invite) ?? undefined;

  if (decision.allowed) {
    if (handle) {
      redirect(`/apps/directory/invites?invite=${encodeURIComponent(handle)}`);
    }
    return null;
  }

  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);

  if (decision.code === 'AUTH_UNAUTHORIZED') {
    const hostedSignIn = getHostedSignInUrl();
    const signInUrl = hostedSignIn ? withSignInReturn(hostedSignIn, returnPath) : '/';
    return (
      <DirectoryPublicShell
        pluginSlug="directory"
        pluginName="Directory"
        signInUrl={signInUrl}
        inviteHandle={handle}
        page={page}
      />
    );
  }

  if (decision.reason === 'unlock_required') {
    return <DirectoryInviteWall page={page} inviteHandle={handle} verifyUrl="/plugin/unlock" />;
  }

  return null;
}
