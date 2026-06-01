import { NextResponse } from 'next/server';
import { parsePositiveInteger, requireSocketRelayAdminAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { reportError } from 'lib/observability/report';
import { SOCKETRELAY_DEFAULT_PAGE, SOCKETRELAY_DEFAULT_PAGE_SIZE } from 'lib/socketrelay/constants';
import { listAdminRequests } from 'lib/socketrelay/repository';

export async function GET(request: Request) {
  const gate = await requireSocketRelayAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const url = new URL(request.url);
    const page = parsePositiveInteger(url.searchParams.get('page'), SOCKETRELAY_DEFAULT_PAGE);
    const pageSize = parsePositiveInteger(url.searchParams.get('pageSize'), SOCKETRELAY_DEFAULT_PAGE_SIZE);
    const response = await listAdminRequests({ page, pageSize });
    return NextResponse.json({ ok: true, ...response }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'admin_requests_list', extra: { userId: gate.auth.userId } });
    return socketRelayErrorResponse(error, 'Admin requests unavailable.');
  }
}
