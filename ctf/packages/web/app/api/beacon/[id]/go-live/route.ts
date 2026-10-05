import { NextResponse } from 'next/server';
import { beaconErrorResponse, ensureBeaconMutationCsrf, requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import {
  getBeaconEvent,
  getLiveBeaconEvent,
  insertBeaconAudit,
  isBeaconUniqueViolation,
  markBeaconEventLive,
  postBeaconLiveNotice,
  revertBeaconEventToDraft,
  type BeaconEvent,
} from 'lib/beacon/repository';
import { goLiveBeaconCall } from 'lib/beacon/stream';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const ANOTHER_LIVE_MESSAGE = 'Another event is already live. End it first.';

function conflict(message: string): NextResponse {
  return NextResponse.json({ ok: false, code: BEACON_ERROR_CODE.conflict, message }, { status: 409 });
}

// Admin: flip a draft event to live (Stream goLive) and auto-post the live-now notice to the Commons.
//
// Only a draft can go live. The database row moves first, with `status = 'draft'` in the UPDATE, so
// it is the lock: of two simultaneous calls for one draft only one gets the row and calls Stream,
// and a second event going live at the same moment is refused by the one-live-event unique index
// before anything leaves backstage. If Stream then fails, the row goes back to draft.
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

  // Put the row back to draft after a failed Stream call. A failure here is reported on its own so it
  // does not hide the Stream error the admin is about to see.
  const revert = async (eventId: string) => {
    try {
      await revertBeaconEventToDraft(eventId);
    } catch (revertError) {
      reportError(revertError, { area: 'beacon', op: 'go_live_revert_to_draft', extra: { eventId } });
    }
  };

  const deny = async (eventId: string, reason: string, message: string) => {
    await insertBeaconAudit({
      actorId: gate.auth.userId,
      command: 'beacon.event.go-live',
      policyStatus: 'deny',
      reason,
      targetType: 'event',
      targetId: eventId,
    });
    return conflict(message);
  };

  try {
    const event = await getBeaconEvent(id);
    if (!event) {
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.notFound, message: 'Event not found.' },
        { status: 404 },
      );
    }

    if (event.status !== 'draft') {
      return deny(
        event.id,
        `not_draft:${event.status}`,
        event.status === 'live' ? 'This event is already live.' : 'This event has ended and cannot go live again.',
      );
    }

    // At most one live event at a time (also enforced by a partial unique index). Block go-live when
    // a different event is already live so the public viewer is never ambiguous.
    const alreadyLive = await getLiveBeaconEvent();
    if (alreadyLive && alreadyLive.id !== event.id) {
      return deny(event.id, 'another_event_live', ANOTHER_LIVE_MESSAGE);
    }

    let liveEvent: BeaconEvent | null;
    try {
      liveEvent = await markBeaconEventLive(event.id);
    } catch (error) {
      if (isBeaconUniqueViolation(error)) {
        return deny(event.id, 'another_event_live', ANOTHER_LIVE_MESSAGE);
      }
      throw error;
    }
    if (!liveEvent) {
      // Another request moved this draft first (a double click, or a second admin).
      return deny(event.id, 'not_draft:changed', 'This event is no longer a draft. Refresh to see its current state.');
    }

    let started: boolean;
    try {
      started = await goLiveBeaconCall(event.id);
    } catch (streamError) {
      await revert(event.id);
      throw streamError;
    }
    if (!started) {
      await revert(event.id);
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.streamUnavailable, message: 'Live video is not configured.' },
        { status: 503 },
      );
    }

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
    return beaconErrorResponse(`Could not start the broadcast: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}
