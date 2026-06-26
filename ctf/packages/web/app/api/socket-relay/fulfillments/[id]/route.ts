import { NextResponse } from 'next/server';
import { requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import { getFulfillmentById } from 'lib/socket-relay/repository';
import { SOCKET_RELAY_ERROR_CODE } from 'lib/socket-relay/constants';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await params;

  try {
    const item = await getFulfillmentById(id);
    if (!item) {
      return NextResponse.json(
        { ok: false, code: SOCKET_RELAY_ERROR_CODE.fulfillmentNotFound, message: 'SocketRelay fulfillment not found.' },
        { status: 404 },
      );
    }

    const isParticipant = item.requesterUserId === gate.auth.userId || item.fulfillerUserId === gate.auth.userId || gate.auth.isAdmin;
    if (!isParticipant) {
      return NextResponse.json(
        { ok: false, code: SOCKET_RELAY_ERROR_CODE.actorNotParticipant, message: 'Not a fulfillment participant.' },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'fulfillments_id' });
    return socketRelayErrorResponse(error, 'Fulfillment lookup unavailable.');
  }
}
