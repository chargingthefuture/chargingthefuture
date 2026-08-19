import { NextResponse } from 'next/server';
import { censusError, ensureCensusMutationCsrf, requireCensusAdminAccess } from '../../../../_lib';
import { deleteCensusEntry } from 'lib/quora-live-census/repository';
import { QUORA_CENSUS_ERROR_CODE } from 'lib/quora-live-census/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteContext = { params: Promise<{ runId: string; entryId: string }> };

// Remove a miscoded entry. Deleting rather than flagging is right here: a wrong row left in place
// keeps counting toward the tally, and the census is small enough to re-add a corrected one.
export async function DELETE(request: Request, context: RouteContext) {
  const gate = await requireCensusAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureCensusMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { runId, entryId } = await context.params;

  try {
    const removed = await deleteCensusEntry(runId, entryId);
    if (!removed) {
      return censusError(
        'No entry with that id in this run.',
        QUORA_CENSUS_ERROR_CODE.notFound,
        404,
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    reportError(error, { area: 'quora-live-census', op: 'delete-entry' });
    return censusError(
      'The entry could not be removed.',
      QUORA_CENSUS_ERROR_CODE.persistenceUnavailable,
      503,
      failureReason(error),
    );
  }
}
