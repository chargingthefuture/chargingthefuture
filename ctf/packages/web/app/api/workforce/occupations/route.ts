import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { reportError } from 'lib/observability/report';
import { listOccupations, parsePaginationParams } from 'lib/workforce/repository';

export async function GET(request: Request) {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const pagination = parsePaginationParams(request.url);
    const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true' && gate.auth.isAdmin;
    const result = await listOccupations(pagination, includeInactive);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'occupations_list', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch occupations.' },
      { status: 503 },
    );
  }
}
