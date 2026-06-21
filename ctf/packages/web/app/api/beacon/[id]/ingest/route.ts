import { NextResponse } from 'next/server';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import { getBeaconEvent, insertBeaconAudit } from 'lib/beacon/repository';
import { createBeaconHostCredentials, ensureBeaconCallAndIngest } from 'lib/beacon/stream';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// Admin: the per-event RTMP ingest URL + stream key (for a phone broadcaster app) and a host token
// (for desktop in-browser screen-share). Only the host token can publish.
export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireBeaconAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await context.params;

  try {
    const event = await getBeaconEvent(id);
    if (!event) {
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.notFound, message: 'Event not found.' },
        { status: 404 },
      );
    }

    const credentials = await createBeaconHostCredentials({
      userId: gate.auth.userId,
      name: buildIdentityDisplayName(gate.auth.username, gate.auth.userId),
      eventId: event.id,
    });
    if (!credentials) {
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.streamUnavailable, message: 'Live video is not configured.' },
        { status: 503 },
      );
    }

    const ingest = await ensureBeaconCallAndIngest({
      eventId: event.id,
      hostUserId: gate.auth.userId,
      hostToken: credentials.hostToken,
    });
    if (!ingest) {
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.streamUnavailable, message: 'Live video is not configured.' },
        { status: 503 },
      );
    }

    await insertBeaconAudit({
      actorId: gate.auth.userId,
      command: 'beacon.event.ingest',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'event',
      targetId: event.id,
      metadata: { streamCallId: credentials.streamCallId },
    });

    return NextResponse.json(
      {
        ok: true,
        rtmpIngestUrl: ingest.rtmpIngestUrl,
        streamKey: ingest.streamKey,
        streamApiKey: credentials.streamApiKey,
        streamCallType: credentials.streamCallType,
        streamCallId: credentials.streamCallId,
        streamUserId: credentials.streamUserId,
        hostToken: credentials.hostToken,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'ingest', extra: { eventId: id } });
    return NextResponse.json(
      { ok: false, code: BEACON_ERROR_CODE.streamUnavailable, message: 'Broadcast input unavailable.' },
      { status: 503 },
    );
  }
}
