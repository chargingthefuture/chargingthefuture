import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { DailyExchangeShell } from '@/components/engagement/daily-exchange-shell';

export const dynamic = 'force-dynamic';

export default async function DailyExchangePage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps');
  }

  return <DailyExchangeShell />;
}
