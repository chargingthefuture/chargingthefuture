import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { listRounds } from 'lib/skills-hunt/repository';
import { SkillsHuntAdminShell } from '@/components/skills-hunt/skills-hunt-admin-shell';

export const dynamic = 'force-dynamic';

export default async function SkillsHuntAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/skills-hunt');
  }

  const rounds = await listRounds(null);
  return <SkillsHuntAdminShell rounds={rounds} />;
}
