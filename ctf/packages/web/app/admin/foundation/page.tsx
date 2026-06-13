import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getCapacityPolicy, getFoundationDashboard } from 'lib/foundation/repository';
import { FoundationAdminShell } from '@/components/foundation/foundation-admin-shell';

export const dynamic = 'force-dynamic';

export default async function FoundationAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/foundation');
  }

  const [dashboard, policy] = await Promise.all([
    getFoundationDashboard(),
    getCapacityPolicy(),
  ]);

  return <FoundationAdminShell dashboard={dashboard} policy={policy} />;
}
