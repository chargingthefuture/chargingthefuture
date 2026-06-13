import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getDashboard, getWorkforceConfig } from 'lib/workforce/repository';
import { WorkforceAdminShell } from '@/components/workforce/workforce-admin-shell';

export const dynamic = 'force-dynamic';

export default async function WorkforceAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/workforce');
  }

  const [dashboard, config] = await Promise.all([
    getDashboard(),
    getWorkforceConfig(),
  ]);

  return <WorkforceAdminShell dashboard={dashboard} config={config} />;
}
