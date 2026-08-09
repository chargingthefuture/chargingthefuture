import { NextResponse } from 'next/server';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import { getBeaconEvent, insertBeaconAudit } from 'lib/beacon/repository';
import { createBeaconHostCredentials, ensureBeaconCallAndIngest } from 'lib/beacon/stream';
import { failureResponse } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function streamNotConfigured(): NextResponse {
  return NextResponse.json(
    { ok: false, code: BEACON_ERROR_CODE.streamUnavailable, message: 'Live video is not configured.' },
    { status: 503 },
  );
}

// Admin: the per-event RTMP ingest URL + stream key (for a phone broadcaster app) and a host token
// (for desktop in-browser screen-share). Only the host token can publish.
//
// Each step answers for itself (rule 137): a broadcast that will not start has to say which step
// failed and why, because the admin reading it is usually on a phone with no access to the logs.
export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireBeaconAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await context.params;

  let event: Awaited<ReturnType<typeof getBeaconEvent>>;
  try {
    event = await getBeaconEvent(id);
  } catch (error) {
    return failureResponse({
      summary: 'Could not load the event',
      error,
      code: BEACON_ERROR_CODE.persistenceUnavailable,
      area: 'beacon',
      op: 'ingest_load_event',
      extra: { eventId: id },
    });
  }
  if (!event) {
    return NextResponse.json(
      { ok: false, code: BEACON_ERROR_CODE.notFound, message: 'Event not found.' },
      { status: 404 },
    );
  }

  let credentials: Awaited<ReturnType<typeof createBeaconHostCredentials>>;
  try {
    credentials = await createBeaconHostCredentials({
      userId: gate.auth.userId,
      name: buildIdentityDisplayName(gate.auth.username, gate.auth.userId),
      eventId: event.id,
    });
  } catch (error) {
    return failureResponse({
      summary: 'Broadcast input unavailable — preparing the host failed',
      error,
      code: BEACON_ERROR_CODE.streamUnavailable,
      area: 'beacon',
      op: 'ingest_host_credentials',
      extra: { eventId: id },
    });
  }
  if (!credentials) {
    return streamNotConfigured();
  }

  let ingest: Awaited<ReturnType<typeof ensureBeaconCallAndIngest>>;
  try {
    ingest = await ensureBeaconCallAndIngest({
      eventId: event.id,
      hostUserId: gate.auth.userId,
      hostToken: credentials.hostToken,
    });
  } catch (error) {
    return failureResponse({
      summary: 'Broadcast input unavailable — opening the broadcast call failed',
      error,
      code: BEACON_ERROR_CODE.streamUnavailable,
      area: 'beacon',
      op: 'ingest_open_call',
      extra: { eventId: id },
    });
  }
  if (!ingest) {
    return streamNotConfigured();
  }

  // The audit row is bookkeeping. A failed write is reported but never answered to the admin as a
  // broadcast failure — the broadcast input above is ready either way.
  try {
    await insertBeaconAudit({
      actorId: gate.auth.userId,
      command: 'beacon.event.ingest',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'event',
      targetId: event.id,
      metadata: { streamCallId: credentials.streamCallId },
    });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'ingest_audit', extra: { eventId: id } });
  }

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
}
