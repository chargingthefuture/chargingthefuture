import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { DirectoryInviteQueueShell } from '@/components/directory/directory-invite-queue-shell';

export const dynamic = 'force-dynamic';

export default async function DirectoryInviteQueuePage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/directory');
  }

  return <DirectoryInviteQueueShell />;
}
