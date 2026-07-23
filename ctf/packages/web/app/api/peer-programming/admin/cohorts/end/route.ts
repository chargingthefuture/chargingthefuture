import { NextResponse } from 'next/server';
import {
  ensureMutationCsrf,
  peerProgrammingErrorResponse,
  requirePeerProgrammingAdminAccess,
} from 'lib/peer-programming/_lib';
import { endCohort, insertPeerProgrammingAudit } from 'lib/peer-programming/repository';
import { PEER_PROGRAMMING_ERROR_CODE } from 'lib/peer-programming/constants';
import { reportError } from 'lib/observability/report';

type EndCohortBody = {
  cohortId?: string;
};

// Admin-only: end (close) a cohort. The cohort's Direct Line becomes read-only — the message and
// reply routes reject posting into an ended cohort. The single standing Cohort 1 can never be ended
// (endCohort throws 'policy_denied', mapped to 403). CSRF-guarded; every attempt is audited.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requirePeerProgrammingAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: EndCohortBody;
  try {
    body = (await request.json()) as EndCohortBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: PEER_PROGRAMMING_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  if (!body.cohortId) {
    return NextResponse.json(
      { ok: false, code: PEER_PROGRAMMING_ERROR_CODE.invalidPayload, message: 'cohortId is required.' },
      { status: 400 },
    );
  }

  try {
    const cohort = await endCohort({ cohortId: body.cohortId, actorId: gate.auth.userId });

    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.cohort.end',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'cohort',
      targetId: cohort.id,
      metadata: { cohortLabel: cohort.cohortLabel, weekStartDate: cohort.weekStartDate },
    });

    return NextResponse.json({ ok: true, cohort }, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'policy_denied') {
      await insertPeerProgrammingAudit({
        actorId: gate.auth.userId,
        command: 'peer-programming.cohort.end',
        policyStatus: 'deny',
        reason: 'standing_cohort_cannot_end',
        targetType: 'cohort',
        targetId: body.cohortId,
      });
    }
    reportError(error, { area: 'peer-programming', op: 'admin-cohort-end' });
    return peerProgrammingErrorResponse(error, 'Ending the cohort failed.');
  }
}
