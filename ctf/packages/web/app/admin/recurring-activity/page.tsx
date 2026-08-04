import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { RecurringActivityAdminShell } from '@/components/recurring-activity/recurring-activity-admin-shell';

export const dynamic = 'force-dynamic';

// Admin-only collusion review for recurring activity (inventory Gaps #4). Read-only: it surfaces
// patterns for a person to look at and changes nothing. A non-admin is sent back to the member hub,
// and the route behind it re-checks the role, so this redirect is convenience, not the guard.
export default async function RecurringActivityAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/recurring-activity');
  }
  return <RecurringActivityAdminShell />;
}
