import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { WhatWorksAdminShell } from '@/components/whatworks/ww-admin-shell';

export const dynamic = 'force-dynamic';

export default async function WhatWorksAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/whatworks');
  }
  return <WhatWorksAdminShell />;
}
