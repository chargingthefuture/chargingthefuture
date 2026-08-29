import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';

export const dynamic = 'force-dynamic';
import { getAdminPanelData } from 'lib/skill-up/repository';
import { SkillUpAdminShell } from '@/components/skill-up/su-admin-shell';

export default async function SkillUpAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps/skill-up');
  }

  const panel = await getAdminPanelData();

  return (
    <SkillUpAdminShell
      kpis={panel.kpis}
      openDisputes={panel.openDisputes}
      pendingValidations={panel.pendingValidations}
    />
  );
}
