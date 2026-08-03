import { NextResponse } from 'next/server';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import { getBeaconEvent, insertBeaconAudit } from 'lib/beacon/repository';
import { createBeaconHostCredentials, ensureBeaconCallAndIngest } from 'lib/beacon/stream';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// How much of an upstream failure reason we pass back to the admin banner. The text comes from Stream
// (or the database driver) and this route is admin-only, but a runaway message should not fill the
// screen.
const MAX_REASON_LENGTH = 300;

function reasonFrom(error: unknown): string {
  const raw = (error instanceof Error ? error.message : String(error)).trim();
  if (raw.length === 0) {
    return 'unknown error';
  }
  return raw.length > MAX_REASON_LENGTH ? `${raw.slice(0, MAX_REASON_LENGTH)}…` : raw;
}

function streamUnavailable(message: string): NextResponse {
  return NextResponse.json(
    { ok: false, code: BEACON_ERROR_CODE.streamUnavailable, message },
    { status: 503 },
  );
}

// Run one setup step and turn a throw into the reason we show the admin. Each step is reported
// separately so the banner names which step failed instead of one generic sentence for all of them —
// a broadcast that will not start is otherwise undiagnosable from the phone the admin is holding.
async function step<T>(
  op: string,
  eventId: string,
  run: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; reason: string }> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    reportError(error, { area: 'beacon', op, extra: { eventId } });
    return { ok: false, reason: reasonFrom(error) };
  }
}

// Admin: the per-event RTMP ingest URL + stream key (for a phone broadcaster app) and a host token
// (for desktop in-browser screen-share). Only the host token can publish.
export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireBeaconAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await context.params;

  const loaded = await step('ingest_load_event', id, () => getBeaconEvent(id));
  if (!loaded.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: BEACON_ERROR_CODE.persistenceUnavailable,
        message: `Could not load the event: ${loaded.reason}`,
      },
      { status: 503 },
    );
  }
  const event = loaded.value;
  if (!event) {
    return NextResponse.json(
      { ok: false, code: BEACON_ERROR_CODE.notFound, message: 'Event not found.' },
      { status: 404 },
    );
  }

  const minted = await step('ingest_host_credentials', id, () =>
    createBeaconHostCredentials({
      userId: gate.auth.userId,
      name: buildIdentityDisplayName(gate.auth.username, gate.auth.userId),
      eventId: event.id,
    }),
  );
  if (!minted.ok) {
    return streamUnavailable(`Broadcast input unavailable — preparing the host failed: ${minted.reason}`);
  }
  const credentials = minted.value;
  if (!credentials) {
    return streamUnavailable('Live video is not configured.');
  }

  const opened = await step('ingest_open_call', id, () =>
    ensureBeaconCallAndIngest({
      eventId: event.id,
      hostUserId: gate.auth.userId,
      hostToken: credentials.hostToken,
    }),
  );
  if (!opened.ok) {
    return streamUnavailable(`Broadcast input unavailable — opening the broadcast call failed: ${opened.reason}`);
  }
  const ingest = opened.value;
  if (!ingest) {
    return streamUnavailable('Live video is not configured.');
  }

  // The audit row is bookkeeping. A failed write is reported but must not be reported to the admin as
  // a broadcast failure — the broadcast input above is ready either way.
  await step('ingest_audit', id, () =>
    insertBeaconAudit({
      actorId: gate.auth.userId,
      command: 'beacon.event.ingest',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'event',
      targetId: event.id,
      metadata: { streamCallId: credentials.streamCallId },
    }),
  );

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
