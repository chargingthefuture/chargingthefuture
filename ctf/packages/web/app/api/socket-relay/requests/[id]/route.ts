import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import { SOCKET_RELAY_ERROR_CODE, SOCKET_RELAY_TAG_LENGTH_MESSAGE } from 'lib/socket-relay/constants';
import {
  getRequestById,
  hasOverlongTag,
  isValidRequestPrice,
  updateRequest,
  validateRequestInput,
} from 'lib/socket-relay/repository';
import { parseRequestInput } from 'lib/socket-relay/parse-input';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

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
    const item = await getRequestById(id);
    if (!item) {
      return NextResponse.json(
        { ok: false, code: SOCKET_RELAY_ERROR_CODE.requestNotFound, message: 'SocketRelay request not found.' },
        { status: 404 },
      );
    }

    // v3 is members-only: there is no public board, so any signed-in member (already past the read
    // gate above) may view any request by its deep link. The old is_public visibility check was a v2
    // remnant that made the detail route 403 on a request the feed list happily showed — the two now
    // agree. `is_public` is retained on the row but no longer gates who can read a request.
    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'requests_id' });
    return socketRelayErrorResponse(error, 'Request lookup unavailable.');
  }
}

export async function PUT(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const input = parseRequestInput(body);
  // Answer the one payload problem a caller can act on by itself before the catch-all message below.
  if (hasOverlongTag(input.tags)) {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: SOCKET_RELAY_TAG_LENGTH_MESSAGE },
      { status: 400 },
    );
  }

  if (!validateRequestInput(input) || !(await isValidRequestPrice(input.priceCurrency, input.priceAmount))) {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: 'Invalid request payload.' },
      { status: 400 },
    );
  }

  const { id } = await params;

  try {
    const item = await updateRequest(id, gate.auth.userId, gate.auth.isAdmin, input);
    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'requests_id' });
    return socketRelayErrorResponse(error, 'Request update unavailable.');
  }
}
