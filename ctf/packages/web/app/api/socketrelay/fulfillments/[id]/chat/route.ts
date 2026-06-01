import { NextResponse } from 'next/server';
import { ensureSocketRelayFulfillmentChannel, createSocketRelayParticipantToken } from 'lib/socketrelay/stream';
import { requireSocketRelayReadAccess } from 'lib/socketrelay/_lib';
import { getFulfillmentById } from 'lib/socketrelay/repository';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { reportError } from 'lib/observability/report';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (!fulfillment || (fulfillment.requesterUserId !== userId && fulfillment.fulfillerUserId !== userId)) {
    return NextResponse.json({ ok: false, message: 'Fulfillment not found or access denied' }, { status: 404 });
  }

  try {
    const channelId = await ensureSocketRelayFulfillmentChannel({
      fulfillmentId: fulfillment.id,
      requesterUserId: fulfillment.requesterUserId,
      requesterDisplayName: buildIdentityDisplayName(null, fulfillment.requesterUserId),
      fulfillerUserId: fulfillment.fulfillerUserId,
      fulfillerDisplayName: buildIdentityDisplayName(null, fulfillment.fulfillerUserId),
    });
    if (!channelId) {
      return NextResponse.json({ ok: false, message: 'Unable to create chat channel' }, { status: 500 });
    }
    const credentials = await createSocketRelayParticipantToken(
      userId,
      buildIdentityDisplayName(gate.auth.username, userId),
    );
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Unable to create participant token' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, channelId, ...credentials });
  } catch (error: unknown) {
    reportError(error, { area: 'socketrelay', op: 'fulfillments_id_chat' });
    const message = error instanceof Error ? error.message : 'Error creating chat channel';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
