import { NextResponse } from 'next/server';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingAdminAccess } from 'lib/peer-programming/_lib';
import {
  insertPeerProgrammingAudit,
  resolveSingleOpenCohortMode,
  setPeerProgrammingSingleOpenCohort,
} from 'lib/peer-programming/repository';
import { reportError } from 'lib/observability/report';

// Admin read + write for the single-standing-cohort mode toggle. The effective mode resolves with
// precedence: persisted admin setting (if set) → env flag PEER_PROGRAMMING_SINGLE_OPEN_COHORT →
// default ON. GET returns the effective decision and its source so the admin surface can show where
// the value comes from; POST persists the admin's explicit choice (or clears it back to "unset").
type ToggleBody = {
  // true / false = explicit admin choice; null = clear the admin setting (revert to env / default).
  enabled?: boolean | null;
};

export async function GET() {
  const gate = await requirePeerProgrammingAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const mode = await resolveSingleOpenCohortMode();
    return NextResponse.json({ ok: true, mode }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'admin_single_open_cohort_get' });
    return peerProgrammingErrorResponse(error, 'Single-open-cohort setting unavailable.');
  }
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requirePeerProgrammingAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: ToggleBody;
  try {
    body = (await request.json()) as ToggleBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'peer_programming_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  // enabled must be exactly true, false, or null (clear the setting). Anything else is rejected.
  if (!(body.enabled === true || body.enabled === false || body.enabled === null)) {
    return NextResponse.json(
      { ok: false, code: 'peer_programming_invalid_payload', message: 'enabled must be true, false, or null.' },
      { status: 400 },
    );
  }

  try {
    await setPeerProgrammingSingleOpenCohort({ actorId: gate.auth.userId, enabled: body.enabled });
    const mode = await resolveSingleOpenCohortMode();

    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.settings.single-open-cohort.set',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'peer_programming_settings',
      targetId: 'single_open_cohort_enabled',
      metadata: { requested: body.enabled, effective: mode.enabled, source: mode.source },
    });

    return NextResponse.json({ ok: true, mode }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'admin_single_open_cohort_set' });
    return peerProgrammingErrorResponse(error, 'Single-open-cohort setting update unavailable.');
  }
}
