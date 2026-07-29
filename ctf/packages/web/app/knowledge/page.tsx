import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getHostedSignInUrl } from 'lib/auth/provider-env';
import { ComicKnowledgeShell } from '@/components/comic/comic-knowledge-shell';

export const dynamic = 'force-dynamic';

// Where a member lends their own public Quora writing to the assistant's reference library, and
// where the consent that permits it is given.
//
// Requires COMPLETED UNLOCK, not merely a signed-in account (owner decision, 2026-07-29). It first
// shipped open to any authenticated member, on the reasoning that someone mid-verification may have
// years of writing worth contributing. What that reasoning missed: reviewing a contribution is
// manual and slow, so the scarce resource is the reviewer's reading time — and an unverified account
// can spend it without ever getting near the assistant. Nothing unreviewed reaches the bot either
// way, but a throwaway account could still put junk in front of a human every day. Verification is
// the cost that makes that not worth doing.
//
// A member who has not verified is sent to the Unlock flow rather than the sign-in page, because
// they are already signed in and telling them to sign in again explains nothing.
//
// A short top-level path (`/knowledge`) rather than one under /apps, because the invitation post
// links here from outside the app and the link should be easy to type and read. Deliberately NOT
// `/contribute`: the Contributions plugin is a different thing entirely — the fundraiser and donation
// surface — and two member-facing paths a word apart would be a standing source of confusion (owner
// decision, 2026-07-29).
export default async function KnowledgePage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    // Signed in but not yet verified → the Unlock flow. Not signed in at all → sign-in.
    if (decision.reason === 'unlock_required') {
      redirect('/plugin/unlock');
    }
    redirect(getHostedSignInUrl() ?? '/sign-in');
  }

  return <ComicKnowledgeShell />;
}
