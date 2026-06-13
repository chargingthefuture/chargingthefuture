import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getUnlockDashboardSnapshot, listUnlockSubmissions } from 'lib/unlock/repository';
import { redirect } from 'next/navigation';
import { UnlockAdminShell } from '@/components/unlock/unlock-admin-shell';

export const dynamic = 'force-dynamic';

export default async function UnlockAdminPage() {
  const access = await evaluatePluginAccess({ requiredRoles: ['admin'], requireUsername: false });
  if (!access.allowed) {
    redirect('/');
  }

  const [dashboard, submissions] = await Promise.all([
    getUnlockDashboardSnapshot(),
    listUnlockSubmissions({ limit: 50 }),
  ]);

  return <UnlockAdminShell dashboard={dashboard} submissions={submissions} />;
}
