import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { listOccupations, parsePaginationParams } from 'lib/workforce/repository';
import { reportError } from 'lib/observability/report';

export async function GET(request: Request) {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const pagination = parsePaginationParams(request.url);
    const result = await listOccupations(pagination);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'occupations' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch occupations.' },
      { status: 503 },
    );
  }
}
