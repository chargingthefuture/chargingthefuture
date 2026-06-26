import { NextResponse } from 'next/server';
import { listAdminProducts } from 'lib/whatworks/repository';
import { isWhatWorksProductStatus } from 'lib/whatworks/constants';
import { requireWhatWorksAdminAccess } from '../../_lib';
import { logWhatWorksAudit } from 'lib/whatworks/audit';

// Moderation queue. Defaults to pending suggestions; `?status=` narrows the list.
// Submitter identity is intentionally never returned — admins moderate content, not people.
export async function GET(request: Request) {
  const gate = await requireWhatWorksAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const status = statusParam && isWhatWorksProductStatus(statusParam) ? statusParam : undefined;
  const products = await listAdminProducts(status);
  logWhatWorksAudit({
    actorId: gate.auth.userId,
    command: 'whatworks.admin.product.list',
    status: 'allow',
    reason: 'admin_route_guard',
    targetType: 'product',
    targetId: status ?? 'all',
    result: 'success',
    errorCategory: null,
  });
  return NextResponse.json({ ok: true, products });
}
