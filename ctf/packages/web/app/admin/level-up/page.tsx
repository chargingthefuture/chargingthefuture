import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';

export const dynamic = 'force-dynamic';
import { getAdminPanelData } from 'lib/level-up/repository';
import { LevelUpAdminShell } from '@/components/level-up/lu-admin-shell';

export default async function LevelUpAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps/level-up');
  }

  const panel = await getAdminPanelData();

  return (
    <LevelUpAdminShell
      kpis={panel.kpis}
      openDisputes={panel.openDisputes}
      pendingValidations={panel.pendingValidations}
    />
  );
}
