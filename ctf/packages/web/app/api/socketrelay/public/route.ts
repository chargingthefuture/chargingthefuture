import { NextResponse } from 'next/server';
import { parsePositiveInteger, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { reportError } from 'lib/observability/report';
import { SOCKETRELAY_DEFAULT_PAGE, SOCKETRELAY_DEFAULT_PAGE_SIZE } from 'lib/socketrelay/constants';
import { listPublicRequests } from 'lib/socketrelay/repository';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = parsePositiveInteger(url.searchParams.get('page'), SOCKETRELAY_DEFAULT_PAGE);
    const pageSize = parsePositiveInteger(url.searchParams.get('pageSize'), SOCKETRELAY_DEFAULT_PAGE_SIZE);
    const response = await listPublicRequests({ page, pageSize });
    return NextResponse.json({ ok: true, ...response }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'public_requests_list' });
    return socketRelayErrorResponse(error, 'Public requests unavailable.');
  }
}
