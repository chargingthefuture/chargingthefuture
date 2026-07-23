import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';

export const dynamic = 'force-dynamic';
import { getAdminPanelData } from 'lib/level-up/repository';
import { listPendingProposals } from 'lib/level-up/auto-cohort';
import { LevelUpAdminShell } from '@/components/level-up/lu-admin-shell';

export default async function LevelUpAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps/level-up');
  }

  const [panel, pendingProposals] = await Promise.all([getAdminPanelData(), listPendingProposals(100)]);

  return (
    <LevelUpAdminShell
      kpis={panel.kpis}
      openDisputes={panel.openDisputes}
      pendingValidations={panel.pendingValidations}
      pendingProposals={pendingProposals}
    />
  );
}
