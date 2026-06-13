import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import {
  listAdminFulfillments,
  listAdminRequests,
  listSocketRelayAdminAnnouncements,
} from 'lib/socketrelay/repository';
import { SocketRelayAdminShell } from '@/components/socketrelay/socketrelay-admin-shell';

export const dynamic = 'force-dynamic';

export default async function SocketRelayAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/socketrelay');
  }

  const [requests, fulfillments, announcements] = await Promise.all([
    listAdminRequests({ page: 1, pageSize: 100 }),
    listAdminFulfillments(),
    listSocketRelayAdminAnnouncements(),
  ]);

  return (
    <SocketRelayAdminShell
      requests={requests.items}
      requestsTotal={requests.total}
      fulfillments={fulfillments}
      announcements={announcements}
    />
  );
}
