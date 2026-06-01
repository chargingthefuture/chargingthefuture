import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { getOccupationById } from 'lib/workforce/repository';
import { reportError } from 'lib/observability/report';

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await params;

  try {
    const occupation = await getOccupationById(id);
    if (!occupation) {
      return NextResponse.json(
        { ok: false, code: WORKFORCE_ERROR_CODE.notFound, message: 'Occupation not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ occupation }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'occupations_id' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch occupation.' },
      { status: 503 },
    );
  }
}
