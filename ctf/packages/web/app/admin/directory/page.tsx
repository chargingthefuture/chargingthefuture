import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { DirectoryAdminShell } from '@/components/directory/directory-admin-shell';

export const dynamic = 'force-dynamic';

export default async function DirectoryAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/directory');
  }

  return <DirectoryAdminShell currentUserId={access.userId} />;
}
