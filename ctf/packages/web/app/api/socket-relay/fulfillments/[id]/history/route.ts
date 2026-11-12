import { NextResponse } from 'next/server';
import { openFulfillmentHistoryChannel, createSocketRelayParticipantToken } from 'lib/socket-relay/stream';
import { ensureMutationCsrf, requireSocketRelayReadAccess } from 'lib/socket-relay/_lib';
import { getFulfillmentById } from 'lib/socket-relay/repository';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { reportError } from 'lib/observability/report';

// POST /api/socket-relay/fulfillments/[id]/history: the messages the two people wrote on the
// fulfillment's Direct Line before 3.1, read-only. New talk happens in the request card's
// conversation; this only opens what was already on Stream, freezing it so nothing more is written.
// 404 when the fulfillment does not exist or never had a Direct Line; 403 for anybody but the two.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }
  const { id } = await params;
  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const userId = gate.auth.userId;
  try {
    const fulfillment = await getFulfillmentById(id);
    if (!fulfillment) {
      return NextResponse.json({ ok: false, message: 'Fulfillment not found.' }, { status: 404 });
    }
    if (fulfillment.requesterUserId !== userId && fulfillment.fulfillerUserId !== userId) {
      return NextResponse.json({ ok: false, message: 'Only the two people on this request can read its earlier messages.' }, { status: 403 });
    }
    const streamChannelId = await openFulfillmentHistoryChannel(fulfillment.id);
    if (!streamChannelId) {
      return NextResponse.json({ ok: false, message: 'There are no earlier messages on this request.' }, { status: 404 });
    }
    const credentials = await createSocketRelayParticipantToken(userId, buildIdentityDisplayName(gate.auth.username, userId));
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'The earlier messages could not be opened: the chat service is not set up.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true, streamChannelId, ...credentials });
  } catch (error: unknown) {
    reportError(error, { area: 'socket-relay', op: 'fulfillments_id_history' });
    const reason = error instanceof Error ? error.message : 'unknown error';
    return NextResponse.json({ ok: false, message: `The earlier messages could not be opened: ${reason}` }, { status: 500 });
  }
}
