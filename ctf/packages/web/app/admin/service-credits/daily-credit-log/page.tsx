import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { DailyCreditLogShell } from '@/components/service-credits/daily-credit-log-shell';

export const dynamic = 'force-dynamic';

// Admin-only, read-only audit log of the day's credit card on Today. The route behind it re-checks
// the role, so this redirect is convenience, not the guard.
export default async function DailyCreditLogPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/service-credits');
  }
  return <DailyCreditLogShell />;
}
