import { NextResponse } from 'next/server';
import { beaconErrorResponse, ensureBeaconMutationCsrf, requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import { deleteDraftBeaconEvent, getBeaconEvent, insertBeaconAudit } from 'lib/beacon/repository';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// Admin: delete a DRAFT event. Drafts only — a mistyped or abandoned draft was previously permanent
// from the app's side and could only be removed straight from the database (owner report).
//
// A live or ended event is refused with 409. That is deliberate: an ended event is public broadcast
// history with a recording attached, and the Beacon deletion contract retains it. The guard is
// enforced twice — here for a clear error message, and again in the SQL predicate of
// deleteDraftBeaconEvent — so neither layer alone is load-bearing.
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
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.notFound, message: 'Event not found.' },
        { status: 404 },
      );
    }

    if (event.status !== 'draft') {
      // Record the refusal too: an attempt to delete broadcast history is exactly the kind of thing
      // the audit trail exists to show.
      await insertBeaconAudit({
        actorId: gate.auth.userId,
        command: 'beacon.event.delete',
        policyStatus: 'deny',
        reason: `not_draft:${event.status}`,
        targetType: 'event',
        targetId: event.id,
      });
      return NextResponse.json(
        {
          ok: false,
          code: BEACON_ERROR_CODE.conflict,
          message: 'Only a draft can be deleted. A broadcast that went live is kept as history.',
        },
        { status: 409 },
      );
    }

    const deleted = await deleteDraftBeaconEvent(event.id);
    if (!deleted) {
      // The event stopped being a draft between the read and the delete (someone took it live).
      // Treat it the same as the refusal above rather than reporting a phantom success.
      return NextResponse.json(
        {
          ok: false,
          code: BEACON_ERROR_CODE.conflict,
          message: 'That draft is no longer a draft. Reload the list and try again.',
        },
        { status: 409 },
      );
    }

    await insertBeaconAudit({
      actorId: gate.auth.userId,
      command: 'beacon.event.delete',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'event',
      targetId: event.id,
    });

    return NextResponse.json({ ok: true, deletedId: event.id }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'delete', extra: { eventId: id } });
    return beaconErrorResponse('Could not delete the draft.');
  }
}
