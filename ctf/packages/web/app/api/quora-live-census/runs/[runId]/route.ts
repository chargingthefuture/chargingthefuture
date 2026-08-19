import { NextResponse } from 'next/server';
import { censusError, ensureCensusMutationCsrf, requireCensusAdminAccess } from '../../_lib';
import {
  getCensusRun,
  getCensusStanceTally,
  listCensusEntries,
  setCensusRunStatus,
} from 'lib/quora-live-census/repository';
import {
  QUORA_CENSUS_ERROR_CODE,
  QUORA_CENSUS_RUN_STATUS,
  type QuoraCensusRunStatus,
} from 'lib/quora-live-census/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteContext = { params: Promise<{ runId: string }> };

// One run with its entries and its stance tally. The tally is computed over live accounts only —
// an account that was gone when checked says nothing about what remains.
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
    const [entries, tally] = await Promise.all([
      listCensusEntries(runId),
      getCensusStanceTally(runId),
    ]);
    return NextResponse.json({ ok: true, run, entries, tally });
  } catch (error) {
    reportError(error, { area: 'quora-live-census', op: 'get-run' });
    return censusError(
      'The census run could not be loaded.',
      QUORA_CENSUS_ERROR_CODE.persistenceUnavailable,
      503,
      failureReason(error),
    );
  }
}

// Close a finished run, or reopen one to correct it. Closing is what makes a run quotable, so it
// is a deliberate action rather than something inferred from the row count.
export async function PATCH(request: Request, context: RouteContext) {
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
      'The update could not be read as JSON.',
      QUORA_CENSUS_ERROR_CODE.invalidPayload,
      400,
      failureReason(error),
    );
  }

  const requested = (body as { status?: unknown } | null)?.status;
  if (typeof requested !== 'string' || !(QUORA_CENSUS_RUN_STATUS as readonly string[]).includes(requested)) {
    return censusError(
      'Set status to open or closed.',
      QUORA_CENSUS_ERROR_CODE.invalidPayload,
      400,
    );
  }

  try {
    const run = await setCensusRunStatus(runId, requested as QuoraCensusRunStatus);
    if (!run) {
      return censusError('No census run with that id.', QUORA_CENSUS_ERROR_CODE.notFound, 404);
    }
    return NextResponse.json({ ok: true, run });
  } catch (error) {
    reportError(error, { area: 'quora-live-census', op: 'set-run-status' });
    return censusError(
      'The run status could not be changed.',
      QUORA_CENSUS_ERROR_CODE.persistenceUnavailable,
      503,
      failureReason(error),
    );
  }
}
