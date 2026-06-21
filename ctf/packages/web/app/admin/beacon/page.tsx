import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { BeaconAdminShell } from '@/components/beacon/beacon-admin-shell';

export const dynamic = 'force-dynamic';

export default async function BeaconAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps/beacon');
  }

  return <BeaconAdminShell />;
}
