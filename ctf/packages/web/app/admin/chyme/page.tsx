import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ChymeStreamUsageShell } from '@/components/chyme/chyme-stream-usage-shell';

export const dynamic = 'force-dynamic';

// The Chyme admin area: the Stream Video minute meter. Read-only. The owner works from a phone, so
// the screen carries the numbers and a control that copies them as plain text (rule 131).
export default async function ChymeAdminPage() {
  const access = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!access.allowed) {
    redirect('/apps/chyme');
  }

  return <ChymeStreamUsageShell />;
}
