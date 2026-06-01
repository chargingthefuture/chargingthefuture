import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { reportError } from 'lib/observability/report';
import { fetchSummaryReport } from 'lib/workforce/repository';

export async function GET() {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const summary = await fetchSummaryReport();
    return NextResponse.json({ summary }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'report_summary_get', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch summary report.' },
      { status: 503 },
    );
  }
}
