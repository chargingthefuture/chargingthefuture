import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { fetchSectorReport } from 'lib/workforce/repository';
import { reportError } from 'lib/observability/report';



export async function GET(_request: Request, { params }: { params: Promise<{ sector: string }> }) {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { sector } = await params;

  try {
    const items = await fetchSectorReport();
    const normalizedSector = sector.toLowerCase();
    const bucket = items.find((item) => item.bucket.toLowerCase() === normalizedSector) ?? null;
    return NextResponse.json({ bucket, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'reports_sector_sector' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch sector report.' },
      { status: 503 },
    );
  }
}
