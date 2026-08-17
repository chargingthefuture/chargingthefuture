import { NextResponse } from 'next/server';
import { beaconErrorResponse, ensureBeaconMutationCsrf, requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { BEACON_ERROR_CODE, BEACON_MAX_TITLE_LENGTH } from 'lib/beacon/constants';
import { createBeaconEvent, insertBeaconAudit } from 'lib/beacon/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

type CreateBody = { title?: string; description?: string };

// Admin: create a draft Beacon event.
export async function POST(request: Request) {
  const csrfDeny = ensureBeaconMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireBeaconAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch (error) {
    return NextResponse.json({ ok: false, code: BEACON_ERROR_CODE.invalidJson, message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  const title = (body.title ?? '').trim();
  if (title.length === 0 || title.length > BEACON_MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { ok: false, code: BEACON_ERROR_CODE.invalidPayload, message: 'A title between 1 and 160 characters is required.' },
      { status: 400 },
    );
  }

  try {
    const event = await createBeaconEvent({
      hostUserId: gate.auth.userId,
      title,
      description: body.description ?? '',
    });
    await insertBeaconAudit({
      actorId: gate.auth.userId,
      command: 'beacon.event.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'event',
      targetId: event.id,
    });
    return NextResponse.json({ ok: true, event }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'event_create' });
    return beaconErrorResponse('Could not create the event.');
  }
}
