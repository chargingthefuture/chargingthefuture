import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { FiresideAdminShell } from '@/components/fireside/fireside-admin-shell';

export const dynamic = 'force-dynamic';

// Moderating Fireside. The plugin shipped with admin routes and two admin lists that opened inside
// the member's own screen, so there was no row for it in the admin directory and nothing at
// /admin/fireside to reach (owner report, 2026-09-16).
//
// Server-role-gated like every other admin page. A non-admin is sent to the member screen rather
// than shown a denial: for them there is nothing wrong, they simply asked for a page that is not
// theirs, and the member screen is the one they wanted.
export default async function FiresideAdminPage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'], requireUsername: false });
  if (!decision.allowed) {
    redirect('/apps/fireside');
  }

  return <FiresideAdminShell />;
}
