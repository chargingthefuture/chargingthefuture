import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { DirectoryPendingSkillProposalsShell } from '@/components/directory/directory-pending-skill-proposals-shell';

export const dynamic = 'force-dynamic';

export default async function DirectoryPendingSkillProposalsPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/directory');
  }

  return <DirectoryPendingSkillProposalsShell />;
}
