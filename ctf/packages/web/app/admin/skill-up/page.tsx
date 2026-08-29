import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';

export const dynamic = 'force-dynamic';
import { getAdminPanelData } from 'lib/skill-up/repository';
import { listPendingProposals } from 'lib/skill-up/auto-cohort';
import { SkillUpAdminShell } from '@/components/skill-up/su-admin-shell';

export default async function SkillUpAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps/skill-up');
  }

  const [panel, pendingProposals] = await Promise.all([getAdminPanelData(), listPendingProposals(100)]);

  return (
    <SkillUpAdminShell
      kpis={panel.kpis}
      openDisputes={panel.openDisputes}
      pendingValidations={panel.pendingValidations}
      enrollments={panel.enrollments}
      pendingProposals={pendingProposals}
    />
  );
}
