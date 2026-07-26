import { NextResponse } from 'next/server';
import { ensureSocketRelayFulfillmentChannel, createSocketRelayParticipantToken } from 'lib/socket-relay/stream';
import { ensureMutationCsrf, requireSocketRelayReadAccess } from 'lib/socket-relay/_lib';
import { getFulfillmentById } from 'lib/socket-relay/repository';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { reportError } from 'lib/observability/report';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, message: 'Missing fulfillment id' }, { status: 400 });
  }

  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const userId = gate.auth.userId;

  const fulfillment = await getFulfillmentById(id);
  // 404 only when it genuinely does not exist; a non-participant on an existing fulfillment gets 403.
  // Returning 404 for the authorization failure would leak existence (a caller could tell "does not
  // exist" from "exists but not mine"), and it would diverge from the sibling routes that return 403.
  if (!fulfillment) {
    return NextResponse.json({ ok: false, message: 'Fulfillment not found' }, { status: 404 });
  }
  if (fulfillment.requesterUserId !== userId && fulfillment.fulfillerUserId !== userId) {
    return NextResponse.json({ ok: false, message: 'You are not a participant in this Direct Line' }, { status: 403 });
  }

  try {
    // Use the handles captured on the fulfillment at claim time so both participants render with a real
    // @name. Passing null here (as before) re-upserted both Stream users nameless and overwrote the good
    // names set at claim, which is why the counterparty showed as a raw user id.
    const streamChannelId = await ensureSocketRelayFulfillmentChannel({
      fulfillmentId: fulfillment.id,
      requesterUserId: fulfillment.requesterUserId,
      requesterDisplayName: buildIdentityDisplayName(fulfillment.requesterUsername, fulfillment.requesterUserId),
      fulfillerUserId: fulfillment.fulfillerUserId,
      fulfillerDisplayName: buildIdentityDisplayName(fulfillment.fulfillerUsername, fulfillment.fulfillerUserId),
    });
    if (!streamChannelId) {
      return NextResponse.json({ ok: false, message: 'Unable to create chat channel' }, { status: 500 });
    }
    const credentials = await createSocketRelayParticipantToken(
      userId,
      buildIdentityDisplayName(gate.auth.username, userId),
    );
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Unable to create participant token' }, { status: 500 });
    }
    // Single canonical key: `streamChannelId` is the real Stream channel id
    // (`socket-relay-fulfillment-<id>`). Web and mobile both read this one key.
    return NextResponse.json({ ok: true, streamChannelId, ...credentials });
  } catch (error: unknown) {
    reportError(error, { area: 'socket-relay', op: 'fulfillments_id_chat' });
    const message = error instanceof Error ? error.message : 'Error creating chat channel';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
