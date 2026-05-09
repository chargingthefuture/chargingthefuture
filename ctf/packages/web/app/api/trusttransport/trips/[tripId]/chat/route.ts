import { NextResponse } from 'next/server';
import { ensureTrustTransportTripChannel, createTrustTransportParticipantToken } from 'lib/trusttransport/stream';
import { requireTrustTransportReadAccess } from 'lib/trusttransport/_lib';
import { getTripById } from 'lib/trusttransport/repository';

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
    const channelId = await ensureTrustTransportTripChannel({
      tripId: trip.id,
      requesterUserId: trip.requesterUserId,
      providerUserId: trip.providerUserId,
    });
    if (!channelId) {
      return NextResponse.json({ ok: false, message: 'Unable to create chat channel' }, { status: 500 });
    }
    const credentials = await createTrustTransportParticipantToken(userId);
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Unable to create participant token' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, channelId, ...credentials });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message || 'Error creating chat channel' }, { status: 500 });
  }
}
