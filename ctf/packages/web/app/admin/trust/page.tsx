import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { TrustAdminShell } from '@/components/trust/trust-admin-shell';

export const dynamic = 'force-dynamic';

export default async function TrustAdminPage() {
  const access = await evaluatePluginAccess({ requiredRoles: ['admin'], requireUsername: false });
  if (!access.allowed) {
    redirect('/');
  }

  return <TrustAdminShell />;
}
