import { NextResponse } from 'next/server';
import { beaconErrorResponse, ensureBeaconMutationCsrf, requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import { getBeaconEvent, insertBeaconAudit, markBeaconEventEnded } from 'lib/beacon/repository';
import { endBeaconCall } from 'lib/beacon/stream';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// Admin: end the broadcast. This is the cost-critical path — it stops the Stream call so video
// billing stops, then flips the event to ended. The recording-ready webhook posts the replay later.
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

    // Stop the call first so billing stops even if the DB update were to fail. A null return means
    // Stream is not configured, in which case there is nothing to stop — proceed to mark ended.
    try {
      await endBeaconCall(event.id);
    } catch (streamError) {
      // Do not block ending the event if the stop call fails; the operator still needs the event
      // marked ended. Surface the failure for follow-up.
      reportError(streamError, { area: 'beacon', op: 'end_stop_call', extra: { eventId: event.id } });
    }

    const endedEvent = (await markBeaconEventEnded(event.id)) ?? event;

    await insertBeaconAudit({
      actorId: gate.auth.userId,
      command: 'beacon.event.end',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'event',
      targetId: event.id,
    });

    return NextResponse.json({ ok: true, event: endedEvent }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'end', extra: { eventId: id } });
    return beaconErrorResponse('Could not end the broadcast.');
  }
}
