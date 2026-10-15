import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';

// Who may read the Directory invite wall in full (owner decision, 2026-10-15).
//
// Any signed-in account, approved in Unlock or not. This is one of the exceptions on
// ctf/config/unlock-tier-exception-allowlist.json, and it is narrow: it opens the invites (each
// person's name, the invite's text, its picture, the Quora address and a link to the listing) and
// nothing else in the Directory. The Directory itself, its search and every listing behind that link
// still need full approval through pluginPageMinUnlockTier.
//
// Why a sign-in and no more: the invites are how people arrive from Quora, and seeing who has been
// invited is the reason to make an account. A sign-in keeps the list off the open web, which is why
// they left the blog. Approval is not asked for because the people reading are mostly the people
// invited, who have not finished Unlock yet.
//
// Every invite-wall surface reads its gate here, so the bypass sits in exactly one file.

export type InviteViewer =
  | { kind: 'signed_out' }
  | { kind: 'denied'; status: number; body: unknown }
  | { kind: 'member'; userId: string; isAdmin: boolean };

export async function resolveInviteViewer(): Promise<InviteViewer> {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'any_authenticated' });
  if (decision.allowed) {
    return { kind: 'member', userId: decision.userId, isAdmin: decision.isAdmin };
  }
  if (decision.code === 'AUTH_UNAUTHORIZED') {
    return { kind: 'signed_out' };
  }
  return { kind: 'denied', status: decision.status, body: decision };
}

/** The gate for the invite API routes: a member, or the response to send instead. */
export async function requireInviteReader(): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  const viewer = await resolveInviteViewer();
  if (viewer.kind === 'member') {
    return { allowed: true };
  }
  if (viewer.kind === 'signed_out') {
    return {
      allowed: false,
      response: NextResponse.json(
        { ok: false, code: 'AUTH_UNAUTHORIZED', message: 'Sign in to read the invitations. Any account can, approved or not.' },
        { status: 401 },
      ),
    };
  }
  return { allowed: false, response: NextResponse.json(viewer.body, { status: viewer.status }) };
}
