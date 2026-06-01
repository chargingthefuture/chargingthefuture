import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireWorkforceAdminAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { reportError } from 'lib/observability/report';
import { deleteOccupation, insertWorkforceAdminAudit, updateOccupation, validateOccupationInput } from 'lib/workforce/repository';
import type { WorkforceOccupationInput } from 'lib/workforce/types';

type RouteParams = {
  params: Promise<{ id: string }>;
};

type OccupationBody = Partial<WorkforceOccupationInput>;

function toOccupationInput(body: OccupationBody): WorkforceOccupationInput {
  return {
    name: typeof body.name === 'string' ? body.name : '',
    sector: typeof body.sector === 'string' ? body.sector : null,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
  };
}

export async function PUT(request: Request, { params }: RouteParams) {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { id } = await params;

  let body: OccupationBody;
  try {
    body = (await request.json()) as OccupationBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = toOccupationInput(body);
  if (!validateOccupationInput(input)) {
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.invalidPayload, message: 'Invalid occupation payload.' },
      { status: 400 },
    );
  }

  try {
    const occupation = await updateOccupation(gate.auth.userId, id, input);
    if (!occupation) {
      return NextResponse.json(
        { ok: false, code: WORKFORCE_ERROR_CODE.notFound, message: 'Occupation not found.' },
        { status: 404 },
      );
    }

    await insertWorkforceAdminAudit({
      actorId: gate.auth.userId,
      command: 'workforce.occupations.admin.update',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'occupation',
      targetId: id,
    });

    return NextResponse.json({ ok: true, occupation }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_occupation_update', extra: { userId: gate.auth.userId, id } });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to update occupation.' },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { id } = await params;

  try {
    const result = await deleteOccupation(id);
    if (result === 'not_found') {
      return NextResponse.json(
        { ok: false, code: WORKFORCE_ERROR_CODE.notFound, message: 'Occupation not found.' },
        { status: 404 },
      );
    }

    await insertWorkforceAdminAudit({
      actorId: gate.auth.userId,
      command: 'workforce.occupations.admin.delete',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'occupation',
      targetId: id,
    });

    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_occupation_delete', extra: { userId: gate.auth.userId, id } });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to delete occupation.' },
      { status: 503 },
    );
  }
}
