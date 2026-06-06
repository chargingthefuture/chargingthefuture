import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';

export const dynamic = 'force-dynamic';
import { getAdminPanelData } from 'lib/levelup/repository';
import { LevelupAdminShell } from '@/components/levelup/lu-admin-shell';

export default async function LevelupAdminPage() {
  const decision = await evaluatePluginAccess({ requireApprovedUserOrAdmin: true, requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps/levelup');
  }

  const panel = await getAdminPanelData();

  return <LevelupAdminShell kpis={panel.kpis} />;
}
