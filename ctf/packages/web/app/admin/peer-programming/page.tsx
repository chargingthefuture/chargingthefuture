import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { PeerProgrammingAdminShell } from '@/components/peer-programming/pp-admin-shell';

export const dynamic = 'force-dynamic';

export default async function PeerProgrammingAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps/peer-programming');
  }

  return <PeerProgrammingAdminShell />;
}
