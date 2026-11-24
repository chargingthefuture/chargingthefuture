import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { WeaversAdminShell } from '@/components/contributor-access/weavers-admin-shell';

export const dynamic = 'force-dynamic';

// Weavers of the Commons: the badge's eligible and scored members, its eligibility settings and the
// gated channel status. The same admin gate as Adoption, which it left on 2026-11-24 (owner
// decision). Each API route it reads does its own admin check as well.
export default async function WeaversAdminPage() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps');
  }

  return <WeaversAdminShell />;
}
