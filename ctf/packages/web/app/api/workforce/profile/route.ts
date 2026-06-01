import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { logWorkforceAudit } from 'lib/workforce/audit';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { reportError } from 'lib/observability/report';
import { deleteOwnWorkforceProfile, getOwnProfile, upsertOwnProfile, validateProfileInput } from 'lib/workforce/repository';
import type { WorkforceProfileInput } from 'lib/workforce/types';

type ProfileBody = Partial<WorkforceProfileInput>;

function toProfileInput(body: ProfileBody): WorkforceProfileInput {
  return {
    occupationId: typeof body.occupationId === 'string' ? body.occupationId : null,
    skillLevel: typeof body.skillLevel === 'string' ? body.skillLevel : 'unknown',
    region: typeof body.region === 'string' ? body.region : null,
    availabilityPreferences: body.availabilityPreferences,
    workPreferences: body.workPreferences,
  };
}

export async function GET() {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const profile = await getOwnProfile(gate.auth.userId);
    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'profile_get', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch profile.' },
      { status: 503 },
    );
  }
}

async function handleUpsert(request: Request) {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: ProfileBody;
  try {
    body = (await request.json()) as ProfileBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = toProfileInput(body);
  if (!validateProfileInput(input)) {
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.invalidPayload, message: 'Invalid profile payload.' },
      { status: 400 },
    );
  }

  try {
    const profile = await upsertOwnProfile(gate.auth.userId, input);

    logWorkforceAudit({
      actorId: gate.auth.userId,
      command: 'workforce.profile.update',
      status: 'allow',
      reason: 'profile_ownership_or_admin',
      targetType: 'profile',
      targetId: gate.auth.userId,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    const isOccupationNotFound = message === 'workforce_occupation_not_found';

    logWorkforceAudit({
      actorId: gate.auth.userId,
      command: 'workforce.profile.update',
      status: 'allow',
      reason: 'profile_ownership_or_admin',
      targetType: 'profile',
      targetId: gate.auth.userId,
      result: 'failure',
      errorCategory: isOccupationNotFound ? 'validation' : 'persistence_error',
    });

    if (!isOccupationNotFound) {
      reportError(error, { area: 'workforce', op: 'profile_upsert', extra: { userId: gate.auth.userId } });
    }

    return NextResponse.json(
      {
        ok: false,
        code: isOccupationNotFound ? WORKFORCE_ERROR_CODE.invalidPayload : WORKFORCE_ERROR_CODE.persistenceUnavailable,
        message: isOccupationNotFound ? 'Occupation not found or inactive.' : 'Unable to save profile.',
      },
      { status: isOccupationNotFound ? 400 : 503 },
    );
  }
}

export async function POST(request: Request) {
  return handleUpsert(request);
}

export async function PUT(request: Request) {
  return handleUpsert(request);
}

export async function DELETE(request: Request) {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  try {
    const deletion = await deleteOwnWorkforceProfile(gate.auth.userId);

    logWorkforceAudit({
      actorId: gate.auth.userId,
      command: 'workforce.profile.delete.service',
      status: 'allow',
      reason: 'service_scope_confirmed',
      targetType: 'profile',
      targetId: gate.auth.userId,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, scope: 'service', status: 'completed', requestedAtIso: deletion.requestedAtIso }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'profile_delete_service', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to delete workforce profile.' },
      { status: 503 },
    );
  }
}
