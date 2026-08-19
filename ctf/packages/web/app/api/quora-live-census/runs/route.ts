import { NextResponse } from 'next/server';
import { censusError, ensureCensusMutationCsrf, requireCensusAdminAccess } from '../_lib';
import { createCensusRun, listCensusRuns } from 'lib/quora-live-census/repository';
import { parseCensusRun } from 'lib/quora-live-census/parse';
import { QUORA_CENSUS_ERROR_CODE } from 'lib/quora-live-census/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

const RUN_LIST_LIMIT = 200;

// Every census run, newest observation date first.
export async function GET() {
  const gate = await requireCensusAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    return NextResponse.json({ ok: true, runs: await listCensusRuns(RUN_LIST_LIMIT) });
  } catch (error) {
    reportError(error, { area: 'quora-live-census', op: 'list-runs' });
    return censusError(
      'The census runs could not be loaded.',
      QUORA_CENSUS_ERROR_CODE.persistenceUnavailable,
      503,
      failureReason(error),
    );
  }
}

// Start a run. The observation date, the scope, and the sampling method are all required, because
// a run missing any of them produces numbers nobody can reproduce or check.
export async function POST(request: Request) {
  const gate = await requireCensusAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureCensusMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return censusError(
      'The run could not be read as JSON.',
      QUORA_CENSUS_ERROR_CODE.invalidPayload,
      400,
      failureReason(error),
    );
  }

  const parsed = parseCensusRun(body, gate.auth.userId);
  if (!parsed.ok) {
    return censusError(parsed.message, QUORA_CENSUS_ERROR_CODE.invalidPayload, 400);
  }

  try {
    return NextResponse.json({ ok: true, run: await createCensusRun(parsed.value) }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'quora-live-census', op: 'create-run' });
    return censusError(
      'The run could not be saved.',
      QUORA_CENSUS_ERROR_CODE.persistenceUnavailable,
      503,
      failureReason(error),
    );
  }
}
