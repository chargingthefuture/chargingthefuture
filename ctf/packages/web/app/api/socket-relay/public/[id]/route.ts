import { NextResponse } from 'next/server';
import { socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import { SOCKET_RELAY_ERROR_CODE } from 'lib/socket-relay/constants';
import { getPublicRequestById } from 'lib/socket-relay/repository';
import { reportError } from 'lib/observability/report';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  // Per-IP brake against bulk scraping of the anonymous read (see lib/security/rate-limit.ts).
  const limited = enforcePublicReadRateLimit(request, 'socket-relay-public-id');
  if (limited) {
    return limited;
  }

  const { id } = await params;

  try {
    const item = await getPublicRequestById(id);
    if (!item) {
      return NextResponse.json(
        { ok: false, code: SOCKET_RELAY_ERROR_CODE.requestNotFound, message: 'SocketRelay request not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'public_id' });
    return socketRelayErrorResponse(error, 'Public request lookup unavailable.');
  }
}
