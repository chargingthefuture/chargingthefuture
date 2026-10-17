import { NextResponse } from 'next/server';
import { ensureTrustTransportTripChannel, createTrustTransportParticipantToken, freezeTrustTransportTripChannel } from 'lib/trust-transport/stream';
import { TRIP_CHAT_READ_ONLY_DAYS, tripChatAccess, type TripChatAccess } from 'lib/trust-transport/trip-chat-window';
import { ensureMutationCsrf, requireTrustTransportReadAccess } from 'lib/trust-transport/_lib';
import { getTripById } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';
import { streamFailureMessage } from 'lib/shared/stream-error-text';

export async function POST(request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  // This POST changes state on Stream (upserts both members, creates the channel, adds members) and
  // mints a token, so it takes the same CSRF check as every other mutation in this plugin.
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

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

  // A trip's chat ends with the trip (issue #2857): read-only once it is completed, canceled or
  // disputed, and closed TRIP_CHAT_READ_ONLY_DAYS after it was completed or canceled. A closed chat
  // gets no token, and the channel is not touched, so its members are not added back to it.
  const access = tripChatAccess(trip);
  if (access.state === 'closed') {
    return NextResponse.json(
      {
        ok: false,
        code: 'trip_chat_closed',
        message: `This trip's chat closed ${TRIP_CHAT_READ_ONLY_DAYS} days after the trip ended.`,
        closedAtIso: access.closedAtIso,
      },
      { status: 410 },
    );
  }

  return openTripChat(trip, userId, access);
}

// Set up the channel and mint the token for a chat that is open or read-only. Its own function so
// POST stays inside the rule-116 complexity limit.
async function openTripChat(
  trip: { id: string; requesterUserId: string; providerUserId: string },
  userId: string,
  access: Exclude<TripChatAccess, { state: 'closed' }>,
): Promise<NextResponse> {
  try {
    const streamChannelId = await ensureTrustTransportTripChannel({
      tripId: trip.id,
      requesterUserId: trip.requesterUserId,
      providerUserId: trip.providerUserId,
    });
    if (!streamChannelId) {
      return NextResponse.json({ ok: false, message: 'Unable to create chat channel' }, { status: 500 });
    }
    const readOnly = access.state === 'read_only';
    if (readOnly) await freezeTrustTransportTripChannel(trip.id);
    const credentials = await createTrustTransportParticipantToken(userId);
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Unable to create participant token' }, { status: 500 });
    }
    // Single canonical key: `streamChannelId` is the real Stream channel id. Web and mobile both read
    // this one key. A trip is text chat only — there is deliberately no video room.
    return NextResponse.json({
      ok: true,
      streamChannelId,
      ...credentials,
      readOnly,
      closesAtIso: access.state === 'read_only' ? access.closesAtIso : null,
    });
  } catch (e) {
    reportError(e, { area: 'trust-transport', op: 'trips_tripid_chat' });
    return NextResponse.json({ ok: false, message: streamFailureMessage('Could not set up the chat channel', e) }, { status: 500 });
  }
}
