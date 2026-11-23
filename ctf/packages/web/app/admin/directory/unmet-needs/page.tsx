import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { DirectoryUnmetNeedsShell } from '@/components/directory/directory-unmet-needs-shell';

export const dynamic = 'force-dynamic';

export default async function DirectoryUnmetNeedsPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/directory');
  }

  return <DirectoryUnmetNeedsShell />;
}
