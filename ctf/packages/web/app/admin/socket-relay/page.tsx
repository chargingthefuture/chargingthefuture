import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import {
  listAdminFulfillments,
  listAdminRequests,
} from 'lib/socket-relay/repository';
import { SocketRelayAdminShell } from '@/components/socket-relay/socket-relay-admin-shell';

export const dynamic = 'force-dynamic';

export default async function SocketRelayAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/socket-relay');
  }

  const [requests, fulfillments] = await Promise.all([
    listAdminRequests({ page: 1, pageSize: 100 }),
    listAdminFulfillments(),
  ]);

  return (
    <SocketRelayAdminShell
      requests={requests.items}
      requestsTotal={requests.total}
      fulfillments={fulfillments}
    />
  );
}
