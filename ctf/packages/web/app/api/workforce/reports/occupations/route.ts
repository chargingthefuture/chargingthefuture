import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { fetchOccupationGapReport } from 'lib/workforce/repository';
import { reportError } from 'lib/observability/report';

// Per-occupation training gaps (demand vs recruited per Skills Taxonomy job title), largest gap
// first. Read-only; this is the breakdown that surfaces which occupations SkillUp should recruit and
// train for. Supports `?limit=` to cap the list (e.g. the dashboard's Top Training Gaps).
export async function GET(request: Request) {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await fetchOccupationGapReport();
    const limitRaw = Number.parseInt(new URL(request.url).searchParams.get('limit') ?? '', 10);
    const limited = Number.isFinite(limitRaw) && limitRaw > 0 ? items.slice(0, limitRaw) : items;
    return NextResponse.json({ items: limited }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'reports_occupations' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch occupation report.' },
      { status: 503 },
    );
  }
}
