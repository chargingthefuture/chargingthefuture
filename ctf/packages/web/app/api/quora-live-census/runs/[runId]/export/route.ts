import { NextResponse } from 'next/server';
import { censusError, requireCensusAdminAccess } from '../../../_lib';
import { getCensusRun, listCensusEntries } from 'lib/quora-live-census/repository';
import { renderCensusCsv } from 'lib/quora-live-census/csv';
import { QUORA_CENSUS_ERROR_CODE } from 'lib/quora-live-census/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteContext = { params: Promise<{ runId: string }> };

// One run as CSV, for analysis and citation outside the app.
export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireCensusAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { runId } = await context.params;

  try {
    const run = await getCensusRun(runId);
    if (!run) {
      return censusError('No census run with that id.', QUORA_CENSUS_ERROR_CODE.notFound, 404);
    }
    const entries = await listCensusEntries(runId);
    return new NextResponse(renderCensusCsv(run, entries), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="quora-live-census-${run.observed_on}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    reportError(error, { area: 'quora-live-census', op: 'export-run' });
    return censusError(
      'The census export could not be built.',
      QUORA_CENSUS_ERROR_CODE.persistenceUnavailable,
      503,
      failureReason(error),
    );
  }
}
