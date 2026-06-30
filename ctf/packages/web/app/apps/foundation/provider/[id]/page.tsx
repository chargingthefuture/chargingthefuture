import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { FoundationShell } from '@/components/foundation/foundation-shell';

// Auth-gated deep link to one Foundation provider (the destination a shared ShareLink points at).
// A signed-in, verified member lands on Foundation opened to this provider's profile; an
// unauthenticated or not-yet-verified visitor is redirected to the Foundation landing — no provider
// data is exposed without auth, matching Foundation's gated model. The `id` segment is the
// directory-profile id (ProviderView.profileId).
export const dynamic = 'force-dynamic';

export default async function FoundationProviderDeepLinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const decision = await evaluatePluginAccess({ requireUsername: true });
  if (!decision.allowed) {
    redirect('/apps/foundation');
  }

  return <FoundationShell isAdmin={decision.isAdmin} initialProviderId={id} />;
}
