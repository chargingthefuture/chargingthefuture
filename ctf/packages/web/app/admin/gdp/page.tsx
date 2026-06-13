import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getLatestPublication } from 'lib/gdp/repository';
import { GdpAdminShell } from '@/components/gdp/gdp-admin-shell';

export const dynamic = 'force-dynamic';

export default async function GdpAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps/gdp');
  }

  const report = await getLatestPublication();

  return <GdpAdminShell report={report} />;
}
