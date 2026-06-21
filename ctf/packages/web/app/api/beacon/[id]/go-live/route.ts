import { NextResponse } from 'next/server';
import { beaconErrorResponse, ensureBeaconMutationCsrf, requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import {
  getBeaconEvent,
  getLiveBeaconEvent,
  insertBeaconAudit,
  markBeaconEventLive,
  postBeaconLiveNotice,
} from 'lib/beacon/repository';
import { goLiveBeaconCall } from 'lib/beacon/stream';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// Admin: flip the event to live (Stream goLive) and auto-post the live-now notice to the Commons.
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

    // At most one live event at a time (also enforced by a partial unique index). Block go-live when
    // a different event is already live so the public viewer is never ambiguous.
    const alreadyLive = await getLiveBeaconEvent();
    if (alreadyLive && alreadyLive.id !== event.id) {
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.conflict, message: 'Another event is already live. End it first.' },
        { status: 409 },
      );
    }

    const started = await goLiveBeaconCall(event.id);
    if (!started) {
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.streamUnavailable, message: 'Live video is not configured.' },
        { status: 503 },
      );
    }

    const liveEvent = (await markBeaconEventLive(event.id)) ?? event;
    const livePostId = await postBeaconLiveNotice(liveEvent);

    await insertBeaconAudit({
      actorId: gate.auth.userId,
      command: 'beacon.event.go-live',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'event',
      targetId: event.id,
      metadata: { commonsLivePostId: livePostId },
    });

    return NextResponse.json({ ok: true, event: { ...liveEvent, commonsLivePostId: livePostId } }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'go_live', extra: { eventId: id } });
    return beaconErrorResponse('Could not start the broadcast.');
  }
}
