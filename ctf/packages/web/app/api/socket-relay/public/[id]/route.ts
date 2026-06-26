import { NextResponse } from 'next/server';
import { socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import { SOCKET_RELAY_ERROR_CODE } from 'lib/socket-relay/constants';
import { getPublicRequestById } from 'lib/socket-relay/repository';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
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
