import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { redirect } from 'next/navigation';
import { ContributionsAdminShell } from '@/components/contributions/admin/contributions-admin-shell';

export const dynamic = 'force-dynamic';

// Owner-only admin console for the Contributions plugin, mirroring app/admin/unlock/page.tsx: the
// server gate requires the admin role and redirects everyone else away. The interactive console
// (queue, drive management, settings) is a client component that talks to the /api/contributions/
// admin routes.
export default async function ContributionsAdminPage() {
  const access = await evaluatePluginAccess({ requiredRoles: ['admin'], requireUsername: false });
  if (!access.allowed) {
    redirect('/');
  }

  return <ContributionsAdminShell />;
}
