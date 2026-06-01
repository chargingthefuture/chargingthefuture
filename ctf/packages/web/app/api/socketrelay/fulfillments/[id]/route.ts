import { NextResponse } from 'next/server';
import { requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { getFulfillmentById } from 'lib/socketrelay/repository';
import { SOCKETRELAY_ERROR_CODE } from 'lib/socketrelay/constants';
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
        { ok: false, code: SOCKETRELAY_ERROR_CODE.fulfillmentNotFound, message: 'SocketRelay fulfillment not found.' },
        { status: 404 },
      );
    }

    const isParticipant = item.requesterUserId === gate.auth.userId || item.fulfillerUserId === gate.auth.userId || gate.auth.isAdmin;
    if (!isParticipant) {
      return NextResponse.json(
        { ok: false, code: SOCKETRELAY_ERROR_CODE.actorNotParticipant, message: 'Not a fulfillment participant.' },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'fulfillments_id' });
    return socketRelayErrorResponse(error, 'Fulfillment lookup unavailable.');
  }
}
