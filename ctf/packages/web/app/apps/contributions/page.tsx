import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getHostedSignInUrl } from 'lib/auth/provider-env';
import { getPluginBySlug } from 'lib/plugins/repository';
import { ContributionsShell } from '@/components/contributions/contributions-shell';
import { ContributionsPublicShell } from '@/components/contributions/contributions-public-shell';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Contributions is open to any signed-in member (the API gate is `any_authenticated`), so this
// dedicated route uses that tier rather than the dynamic [pluginSlug] route's full-Unlock default.
// A signed-out visitor sees the public marketing shell; the registry entry must be visible.
export default async function ContributionsPage() {
  const plugin = await getPluginBySlug('contributions');
  if (!plugin || !plugin.isVisible) {
    notFound();
  }

  const decision = await evaluatePluginAccess({ minUnlockTier: 'any_authenticated', requireUsername: false });

  if (!decision.allowed) {
    // Anonymous visitor: show the public marketing shell with a real sign-in URL. Any other deny
    // (e.g. a role requirement) also lands here; the public shell is a safe, non-leaking fallback.
    const signInUrl = getHostedSignInUrl() ?? '/sign-in';
    return <ContributionsPublicShell pluginSlug="contributions" pluginName="Contributions" signInUrl={signInUrl} />;
  }

  return <ContributionsShell />;
}
