import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { fetchSectorReport } from 'lib/workforce/repository';
import { fetchSectorDetail } from 'lib/workforce/detail';
import { reportError } from 'lib/observability/report';



export async function GET(_request: Request, { params }: { params: Promise<{ sector: string }> }) {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { sector } = await params;

  try {
    const normalizedSector = sector.toLowerCase();
    // `all` returns the full breakdown (the dashboard uses this); a specific sector returns only its own
    // bucket plus its matched-member drilldown (`detail`), so a single-sector request never leaks the
    // whole cross-sector dataset. `items` is kept for back-compat per workforce.report.sector.fetch.
    if (normalizedSector === 'all') {
      const items = await fetchSectorReport();
      return NextResponse.json({ items }, { status: 200 });
    }
    const detail = await fetchSectorDetail(sector);
    const items = detail
      ? [{ bucket: detail.bucket, target: detail.target, members: detail.members, recruited: detail.recruited, gap: detail.gap }]
      : [];
    return NextResponse.json({ items, detail }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'reports_sector_sector' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch sector report.' },
      { status: 503 },
    );
  }
}
