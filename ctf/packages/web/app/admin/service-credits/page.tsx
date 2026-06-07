import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ServiceCreditsAdminShell } from '@/components/service-credits/service-credits-admin-shell';

export const dynamic = 'force-dynamic';

export default async function ServiceCreditsAdminPage() {
  const decision = await evaluatePluginAccess({ requireApprovedUserOrAdmin: true, requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps/service-credits');
  }

  return <ServiceCreditsAdminShell />;
}
