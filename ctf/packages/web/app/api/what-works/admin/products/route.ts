import { NextResponse } from 'next/server';
import { listAdminProducts } from 'lib/what-works/repository';
import { isWhatWorksProductStatus } from 'lib/what-works/constants';
import { requireWhatWorksAdminAccess } from '../../_lib';
import { logWhatWorksAudit } from 'lib/what-works/audit';
import { failureResponse } from 'lib/errors/failure';

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
  let products: Awaited<ReturnType<typeof listAdminProducts>>;
  try {
    products = await listAdminProducts(status);
  } catch (error) {
    return failureResponse({
      summary: 'Could not load the suggestion queue',
      error,
      code: 'what_works_admin_product_list_failed',
      area: 'what-works',
      op: 'admin_product_list',
    });
  }
  logWhatWorksAudit({
    actorId: gate.auth.userId,
    command: 'what-works.admin.product.list',
    status: 'allow',
    reason: 'admin_route_guard',
    targetType: 'product',
    targetId: status ?? 'all',
    result: 'success',
    errorCategory: null,
  });
  return NextResponse.json({ ok: true, products });
}
