import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { WeaversEarnedPage } from '@/components/contributor-access/weavers-earned-page';

// Signed-in "how it's earned" page for the "Weavers of the Commons" contributor badge — the
// destination of the badge dialog's "How it's earned" link on a Directory profile. Gated the same
// way as the profile deep-link page beside it: a signed-in member sees the explainer, everyone
// else is redirected to the directory landing. Static segment, so it wins over the [handle]
// dynamic sibling.
export const dynamic = 'force-dynamic';

export default async function WeaversOfTheCommonsPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    redirect('/apps/directory');
  }

  return <WeaversEarnedPage />;
}
