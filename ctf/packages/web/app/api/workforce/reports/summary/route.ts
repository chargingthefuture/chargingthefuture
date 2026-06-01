import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { fetchSummaryReport } from 'lib/workforce/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const summary = await fetchSummaryReport();
    return NextResponse.json({ summary }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'reports_summary' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch summary report.' },
      { status: 503 },
    );
  }
}
