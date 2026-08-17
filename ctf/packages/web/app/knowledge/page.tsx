import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getHostedSignInUrl } from 'lib/auth/provider-env';
import { needsQuoraProfileUrl } from 'lib/comic/contribution-unlock-link';
import { ComicKnowledgeShell } from '@/components/comic/comic-knowledge-shell';
import { ComicKnowledgePublicShell } from '@/components/comic/comic-knowledge-public-shell';

export const dynamic = 'force-dynamic';

// Where a member lends their own public Quora writing to the assistant's reference library, and
// where the consent that permits it is given.
//
// OPEN TO ANY SIGNED-IN MEMBER, not only verified ones (owner decision, 2026-07-29). Contributing is
// a route INTO verification rather than something gated behind it: judging a contribution means
// opening the contributor's Quora account and seeing a real person writing real things, which is the
// same look Unlock asks for. Gating this behind Unlock would review the same account twice and make
// the most useful thing a new member can do into something they have to wait for.
//
// A signed-out visitor gets the public landing page rather than a redirect. This page is what the
// invitation post links to from Quora, so most people opening it have no account yet — bouncing them
// to a sign-in form would explain nothing about what they were being asked for.
//
// A short top-level path (`/knowledge`) rather than one under /apps, because that link is read
// outside the app and should be easy to type. Deliberately NOT `/contribute`: the Contributions
// plugin is the fundraiser and donation surface, and two member-facing paths a word apart would be a
// standing source of confusion.
export default async function KnowledgePage() {
  const decision = await evaluatePluginAccess({ minUnlockTier: 'any_authenticated', requireUsername: false });
  if (!decision.allowed) {
    return <ComicKnowledgePublicShell signInUrl={getHostedSignInUrl() ?? '/sign-in'} />;
  }

  // Ask for a Quora profile URL only when this member has none on file. Someone who already
  // submitted through Unlock is never asked again (owner decision): the contribution attaches to the
  // account they already have, and two conflicting URLs can never reach one account via this page.
  const askForQuoraUrl = await needsQuoraProfileUrl(decision.userId);

  return <ComicKnowledgeShell askForQuoraUrl={askForQuoraUrl} />;
}
