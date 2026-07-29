import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getHostedSignInUrl } from 'lib/auth/provider-env';
import { ComicKnowledgeShell } from '@/components/comic/comic-knowledge-shell';

export const dynamic = 'force-dynamic';

// Where a member lends their own public Quora writing to the assistant's reference library, and
// where the consent that permits it is given.
//
// Signed-in only, at `any_authenticated` rather than full Unlock access: someone who has not finished
// verifying can still have years of public writing worth contributing, and consent is the thing that
// makes it usable — not their verification tier. It stays gated to a signed-in account because a
// contribution has to be attributable to the person consenting, and withdrawal has to be something
// only they can do.
//
// A short top-level path (`/knowledge`) rather than one under /apps, because the invitation post
// links here from outside the app and the link should be easy to type and read. Deliberately NOT
// `/contribute`: the Contributions plugin is a different thing entirely — the fundraiser and donation
// surface — and two member-facing paths a word apart would be a standing source of confusion (owner
// decision, 2026-07-29).
export default async function KnowledgePage() {
  const decision = await evaluatePluginAccess({ minUnlockTier: 'any_authenticated', requireUsername: false });
  if (!decision.allowed) {
    redirect(getHostedSignInUrl() ?? '/sign-in');
  }

  return <ComicKnowledgeShell />;
}
