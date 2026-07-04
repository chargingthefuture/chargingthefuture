import { notFound, redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getHostedSignInUrl } from 'lib/auth/provider-env';
import { getPluginBySlug } from 'lib/plugins/repository';
import { RecurringActivityShell } from '@/components/recurring-activity/recurring-activity-shell';

export const dynamic = 'force-dynamic';

// Recurring Activity is open to any signed-in, unlocked member (the API gate is the default
// authenticated tier). A signed-out visitor is sent to sign in; the registry entry must be visible.
export default async function RecurringActivityPage() {
  const plugin = await getPluginBySlug('recurring-activity');
  if (!plugin || !plugin.isVisible) {
    notFound();
  }

  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    redirect(getHostedSignInUrl() ?? '/sign-in');
  }

  return <RecurringActivityShell />;
}
