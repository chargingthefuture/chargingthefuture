import { NextResponse } from 'next/server';
import { censusError, ensureCensusMutationCsrf, requireCensusAdminAccess } from '../../../_lib';
import { createCensusEntry, getCensusRun } from 'lib/quora-live-census/repository';
import { parseCensusEntry } from 'lib/quora-live-census/parse';
import { QUORA_CENSUS_ERROR_CODE } from 'lib/quora-live-census/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteContext = { params: Promise<{ runId: string }> };

// Postgres reports a broken unique index as 23505. The census indexes (run_id, lower(handle)), so
// this is always the same mistake: the same account coded twice inside one run, which would double
// its weight in the tally.
function isDuplicateHandle(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';
}

// Add one coded account to a run.
export async function POST(request: Request, context: RouteContext) {
  const gate = await requireCensusAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureCensusMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { runId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return censusError(
      'The entry could not be read as JSON.',
      QUORA_CENSUS_ERROR_CODE.invalidPayload,
      400,
      failureReason(error),
    );
  }

  const parsed = parseCensusEntry(body, runId);
  if (!parsed.ok) {
    return censusError(parsed.message, QUORA_CENSUS_ERROR_CODE.invalidPayload, 400);
  }

  try {
    const run = await getCensusRun(runId);
    if (!run) {
      return censusError('No census run with that id.', QUORA_CENSUS_ERROR_CODE.notFound, 404);
    }
    // A closed run is the citable version of itself. Letting entries land afterward would change a
    // number someone may already have quoted, so reopen it deliberately instead.
    if (run.status === 'closed') {
      return censusError(
        'This run is closed. Reopen it before adding entries.',
        QUORA_CENSUS_ERROR_CODE.runClosed,
        409,
      );
    }

    return NextResponse.json(
      { ok: true, entry: await createCensusEntry(parsed.value) },
      { status: 201 },
    );
  } catch (error) {
    if (isDuplicateHandle(error)) {
      return censusError(
        'That handle is already coded in this run.',
        QUORA_CENSUS_ERROR_CODE.duplicateHandle,
        409,
        failureReason(error),
      );
    }
    reportError(error, { area: 'quora-live-census', op: 'create-entry' });
    return censusError(
      'The entry could not be saved.',
      QUORA_CENSUS_ERROR_CODE.persistenceUnavailable,
      503,
      failureReason(error),
    );
  }
}
