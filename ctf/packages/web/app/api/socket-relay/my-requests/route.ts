import { NextResponse } from 'next/server';
import { parsePositiveInteger, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import { SOCKET_RELAY_DEFAULT_PAGE, SOCKET_RELAY_DEFAULT_PAGE_SIZE } from 'lib/socket-relay/constants';
import { listRequests } from 'lib/socket-relay/repository';
import { reportError } from 'lib/observability/report';

export async function GET(request: Request) {
  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const url = new URL(request.url);
    const page = parsePositiveInteger(url.searchParams.get('page'), SOCKET_RELAY_DEFAULT_PAGE);
    const pageSize = parsePositiveInteger(url.searchParams.get('pageSize'), SOCKET_RELAY_DEFAULT_PAGE_SIZE);

    const response = await listRequests({
      page,
      pageSize,
      ownerUserId: gate.auth.userId,
    });

    return NextResponse.json({ ok: true, ...response }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'my_requests' });
    return socketRelayErrorResponse(error, 'My requests listing unavailable.');
  }
}
