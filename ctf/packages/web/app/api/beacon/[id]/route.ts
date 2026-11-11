import { NextResponse } from 'next/server';
import { beaconErrorResponse, ensureBeaconMutationCsrf, requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { BEACON_ERROR_CODE, BEACON_MAX_TITLE_LENGTH } from 'lib/beacon/constants';
import {
  deleteBeaconEvent,
  getBeaconEvent,
  insertBeaconAudit,
  removeBeaconCommonsNotices,
  renameBeaconEvent,
} from 'lib/beacon/repository';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function notFound() {
  return NextResponse.json({ ok: false, code: BEACON_ERROR_CODE.notFound, message: 'Event not found.' }, { status: 404 });
}

// Admin: rename an event, in any status — before it goes live, while it is live, or after it ended
// (owner report: a typo in a title could not be fixed). The viewer, the replays list, Today and the
// podcast feed all read the title, so the new one shows everywhere the event appears. A Commons
// notice already posted keeps the words it was posted with.
export async function PATCH(request: Request, context: RouteContext) {
  const csrfDeny = ensureBeaconMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireBeaconAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await context.params;

  let body: { title?: unknown };
  try {
    body = (await request.json()) as { title?: unknown };
  } catch {
    // no-trace: an unreadable body is answered with the same 400 as a missing title.
    body = {};
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title.length === 0 || title.length > BEACON_MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { ok: false, code: BEACON_ERROR_CODE.invalidPayload, message: `A title between 1 and ${BEACON_MAX_TITLE_LENGTH} characters is required.` },
      { status: 400 },
    );
  }

  try {
    const before = await getBeaconEvent(id);
    if (!before) {
      return notFound();
    }
    const event = await renameBeaconEvent(before.id, title);
    if (!event) {
      return notFound();
    }

    await insertBeaconAudit({
      actorId: gate.auth.userId,
      command: 'beacon.event.rename',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'event',
      targetId: event.id,
      metadata: { status: event.status, previousTitle: before.title, title: event.title },
    });

    return NextResponse.json({ ok: true, id: event.id, title: event.title }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'rename', extra: { eventId: id } });
    return beaconErrorResponse('Could not rename the event.');
  }
}

// Admin: delete a draft or an ended event (owner decision, 2026-11-10). A failed broadcast with no
// sound, or a test, stays in the Event history, the replays list, Today and the podcast feed until
// it is deleted; deleting the row removes it from all of them, and the Commons notices it posted
// ("live now" and the replay) are removed with it.
//
// A live event is refused with 409: end the broadcast first. The guard is enforced twice — here for
// a clear error message, and again in the SQL predicate of deleteBeaconEvent — so neither layer
// alone is load-bearing. The copy of the recording on a GitHub release
// (`beacon-recording-<eventId>`) is not touched by the app; the archive workflow stops looking at
// the event once its row is gone.
export async function DELETE(request: Request, context: RouteContext) {
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
      return notFound();
    }

    if (event.status === 'live') {
      // Record the refusal too: an attempt to delete a broadcast in progress is exactly the kind of
      // thing the audit trail exists to show.
      await insertBeaconAudit({
        actorId: gate.auth.userId,
        command: 'beacon.event.delete',
        policyStatus: 'deny',
        reason: 'live',
        targetType: 'event',
        targetId: event.id,
      });
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.conflict, message: 'This broadcast is live. End it first, then delete it.' },
        { status: 409 },
      );
    }

    const deleted = await deleteBeaconEvent(event.id);
    if (!deleted) {
      // The event went live between the read and the delete. Treat it the same as the refusal
      // above rather than reporting a phantom success.
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.conflict, message: 'That event went live. End it first, then delete it.' },
        { status: 409 },
      );
    }

    const commonsNoticesRemoved = await removeBeaconCommonsNotices(deleted);

    await insertBeaconAudit({
      actorId: gate.auth.userId,
      command: 'beacon.event.delete',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'event',
      targetId: deleted.id,
      metadata: { status: deleted.status, title: deleted.title, hadRecording: Boolean(deleted.recordingUrl), commonsNoticesRemoved },
    });

    return NextResponse.json({ ok: true, deletedId: deleted.id }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'delete', extra: { eventId: id } });
    return beaconErrorResponse('Could not delete the event.');
  }
}
