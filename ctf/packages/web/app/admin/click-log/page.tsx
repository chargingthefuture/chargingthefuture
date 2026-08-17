import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ClickLogAdminTrends } from '@/components/click-log/click-log-admin-trends';

export const dynamic = 'force-dynamic';

export default async function ClickLogAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/click-log');
  }
  return <ClickLogAdminTrends />;
}
