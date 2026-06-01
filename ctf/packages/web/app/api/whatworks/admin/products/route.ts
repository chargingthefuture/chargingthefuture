import { NextResponse } from 'next/server';
import { listAdminProducts } from 'lib/whatworks/repository';
import { isWhatWorksProductStatus } from 'lib/whatworks/constants';
import { requireWhatWorksAdminAccess } from '../../_lib';

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
  return NextResponse.json({ ok: true, products });
}
