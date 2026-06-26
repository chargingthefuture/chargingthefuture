import { NextResponse } from 'next/server';
import { ensureTrustTransportTripChannel, createTrustTransportParticipantToken } from 'lib/trust-transport/stream';
import { requireTrustTransportReadAccess } from 'lib/trust-transport/_lib';
import { getTripById } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';

export async function POST(_request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  if (!tripId) {
    return NextResponse.json({ ok: false, message: 'Missing tripId' }, { status: 400 });
  }

  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const userId = gate.auth.userId;

  const trip = await getTripById(tripId);
  if (!trip || (trip.requesterUserId !== userId && trip.providerUserId !== userId)) {
    return NextResponse.json({ ok: false, message: 'Trip not found or access denied' }, { status: 404 });
  }

  try {
    const streamChannelId = await ensureTrustTransportTripChannel({
      tripId: trip.id,
      requesterUserId: trip.requesterUserId,
      providerUserId: trip.providerUserId,
    });
    if (!streamChannelId) {
      return NextResponse.json({ ok: false, message: 'Unable to create chat channel' }, { status: 500 });
    }
    const credentials = await createTrustTransportParticipantToken(userId);
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Unable to create participant token' }, { status: 500 });
    }
    // Single canonical key: `streamChannelId` is the real Stream channel id. Web and mobile both read
    // this one key. A trip is text chat only — there is deliberately no video room.
    return NextResponse.json({ ok: true, streamChannelId, ...credentials });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    reportError(e, { area: 'trust-transport', op: 'trips_tripid_chat' });
    return NextResponse.json({ ok: false, message: e.message || 'Error creating chat channel' }, { status: 500 });
  }
}
