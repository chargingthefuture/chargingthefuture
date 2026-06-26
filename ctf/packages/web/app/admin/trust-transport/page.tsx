import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getMarketConfig, listAuditEvents, listIncidents } from 'lib/trust-transport/repository';
import { TrustTransportAdminShell } from '@/components/trust-transport/trust-transport-admin-shell';

export const dynamic = 'force-dynamic';

export default async function TrustTransportAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/trust-transport');
  }

  const [incidents, marketConfig, auditEvents] = await Promise.all([
    listIncidents(),
    getMarketConfig(),
    listAuditEvents(),
  ]);

  return <TrustTransportAdminShell incidents={incidents} marketConfig={marketConfig} auditEvents={auditEvents} />;
}
