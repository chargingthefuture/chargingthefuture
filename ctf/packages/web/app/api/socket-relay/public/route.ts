import { NextResponse } from 'next/server';
import { parsePositiveInteger, socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import { SOCKET_RELAY_DEFAULT_PAGE, SOCKET_RELAY_DEFAULT_PAGE_SIZE } from 'lib/socket-relay/constants';
import { listPublicRequests } from 'lib/socket-relay/repository';
import { reportError } from 'lib/observability/report';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';

export async function GET(request: Request) {
  // Per-IP brake against bulk scraping of the anonymous read (see lib/security/rate-limit.ts).
  const limited = enforcePublicReadRateLimit(request, 'socket-relay-public');
  if (limited) {
    return limited;
  }

  try {
    const url = new URL(request.url);
    const page = parsePositiveInteger(url.searchParams.get('page'), SOCKET_RELAY_DEFAULT_PAGE);
    const pageSize = parsePositiveInteger(url.searchParams.get('pageSize'), SOCKET_RELAY_DEFAULT_PAGE_SIZE);
    const response = await listPublicRequests({ page, pageSize });
    return NextResponse.json({ ok: true, ...response }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'public' });
    return socketRelayErrorResponse(error, 'Public requests unavailable.');
  }
}
