import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ChymeReadingsAdmin } from '@/components/chyme/readings/chyme-readings-admin';

export const dynamic = 'force-dynamic';

// The Chyme readings loop: the on/off switch and the list of recordings (temporary module, owner
// decision 2026-09-28). Admin only.
export default async function ChymeReadingsAdminPage() {
  const access = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!access.allowed) {
    redirect('/apps/chyme');
  }

  return <ChymeReadingsAdmin />;
}
