import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireWorkforceAdminAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { createOccupation, insertWorkforceAdminAudit, listOccupations, parsePaginationParams, validateOccupationInput } from 'lib/workforce/repository';
import type { WorkforceOccupationInput } from 'lib/workforce/types';
import { reportError } from 'lib/observability/report';

type OccupationBody = Partial<WorkforceOccupationInput>;

function toOccupationInput(body: OccupationBody): WorkforceOccupationInput {
  return {
    name: typeof body.name === 'string' ? body.name : '',
    sector: typeof body.sector === 'string' ? body.sector : null,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
  };
}

export async function GET(request: Request) {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const pagination = parsePaginationParams(request.url);
    const result = await listOccupations(pagination, true);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_occupations' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch occupations.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

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
    const occupation = await createOccupation(gate.auth.userId, input);

    await insertWorkforceAdminAudit({
      actorId: gate.auth.userId,
      command: 'workforce.occupations.admin.create',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'occupation',
      targetId: occupation.id,
    });

    return NextResponse.json({ ok: true, occupation }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_occupations' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to create occupation.' },
      { status: 503 },
    );
  }
}
