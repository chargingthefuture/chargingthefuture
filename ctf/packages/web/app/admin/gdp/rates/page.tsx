import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import GdpRateAdmin from '@/components/gdp/gdp-rate-admin';

export const dynamic = 'force-dynamic';

export default async function GdpRateAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps/gdp');
  }

  return <GdpRateAdmin />;
}
