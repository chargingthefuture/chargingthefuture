import { notFound } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getHostedSignInUrl } from 'lib/auth/provider-env';
import { getPluginBySlug } from 'lib/plugins/repository';
import { RecurringActivityShell } from '@/components/recurring-activity/recurring-activity-shell';
import { RecurringActivityPublicShell } from '@/components/recurring-activity/recurring-activity-public-shell';

export const dynamic = 'force-dynamic';

// Recurring Activity is open to any signed-in, unlocked member. This dedicated route mirrors the
// dynamic [pluginSlug] route's public-visitor handling: a signed-out visitor (or a signed-in member
// who is not verified yet) sees the marketing landing shell rather than being bounced to sign-in —
// so the /apps/recurring-activity URL is shareable and always shows something. The registry entry
// must be visible.
export default async function RecurringActivityPage() {
  const plugin = await getPluginBySlug('recurring-activity');
  if (!plugin || !plugin.isVisible) {
    notFound();
  }

  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    const signInUrl = getHostedSignInUrl() ?? '/sign-in';
    // A signed-in-but-not-yet-verified member (denied with `unlock_required`) is already
    // authenticated, so the shell shows a single "Finish verifying" CTA pointing at the Unlock flow;
    // an anonymous visitor gets the normal sign-in / join CTAs. Any other deny falls through to the
    // same public shell, which is a safe, non-leaking fallback.
    const verifyUrl = decision.reason === 'unlock_required' ? '/plugin/unlock' : undefined;
    return (
      <RecurringActivityPublicShell
        pluginSlug="recurring-activity"
        pluginName="Recurring Activity"
        signInUrl={signInUrl}
        verifyUrl={verifyUrl}
      />
    );
  }

  return <RecurringActivityShell />;
}
