import { NextResponse } from 'next/server';
import { beaconErrorResponse, ensureBeaconMutationCsrf, requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import { getBeaconEvent, insertBeaconAudit } from 'lib/beacon/repository';
import { startBeaconBroadcastEgress } from 'lib/beacon/stream';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// Admin: start the public HLS broadcast and recording once a host is publishing media to the
// livestream call. Go-live only flips the call out of backstage; this starts the egress (HLS +
// recording) at the moment media exists, which is when the in-browser screen-share host begins
// sharing. Safe to call again: a start for something already running counts as success.
export async function POST(request: Request, context: RouteContext) {
  const csrfDeny = ensureBeaconMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

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

    // The egress call puts the call on air with HLS and recording on, so it runs only for the live
    // event. A draft goes live through go-live; an ended event must stay off air.
    if (event.status !== 'live') {
      await insertBeaconAudit({
        actorId: gate.auth.userId,
        command: 'beacon.event.start-broadcast',
        policyStatus: 'deny',
        reason: `not_live:${event.status}`,
        targetType: 'event',
        targetId: event.id,
      });
      return NextResponse.json(
        {
          ok: false,
          code: BEACON_ERROR_CODE.conflict,
          message: event.status === 'draft' ? 'Go live first, then start the broadcast.' : 'This event has ended, so the broadcast cannot start.',
        },
        { status: 409 },
      );
    }

    const started = await startBeaconBroadcastEgress(event.id);
    if (!started) {
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.streamUnavailable, message: 'Live video is not configured.' },
        { status: 503 },
      );
    }

    await insertBeaconAudit({
      actorId: gate.auth.userId,
      command: 'beacon.event.start-broadcast',
      policyStatus: 'allow',
      reason: 'ok: public feed and recording started',
      targetType: 'event',
      targetId: event.id,
      metadata: {},
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'start_broadcast', extra: { eventId: id } });
    const reason = error instanceof Error ? error.message : 'unknown error';
    // Written to the event's log so the admin history shows why the recording never started.
    try {
      await insertBeaconAudit({
        actorId: gate.auth.userId,
        command: 'beacon.event.start-broadcast',
        policyStatus: 'deny',
        reason: `Starting the public feed or recording failed: ${reason}`,
        targetType: 'event',
        targetId: id,
      });
    } catch (auditError) {
      reportError(auditError, { area: 'beacon', op: 'start_broadcast_log', extra: { eventId: id } });
    }
    return beaconErrorResponse(`Could not start the public broadcast: ${reason}`);
  }
}
