import { NextResponse } from 'next/server';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingAdminAccess } from 'lib/peer-programming/_lib';
import {
  insertPeerProgrammingAudit,
  resolveSingleOpenCohortMode,
  setPeerProgrammingSingleOpenCohort,
} from 'lib/peer-programming/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

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
    // The contract documents the four fields flat (enabled/source/adminSetting/envFlagEnabled);
    // the web admin shell reads the nested `mode` object. Return both so the response satisfies
    // the contract shape without breaking the existing consumer.
    return NextResponse.json({ ok: true, ...mode, mode }, { status: 200 });
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
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'peer_programming_invalid_json', message: `Invalid JSON body: ${failureReason(error)}` }, { status: 400 });
  }

  // enabled is true / false = explicit admin choice; null OR a missing key (undefined) both mean
  // "clear the setting" (revert to env / default), since the contract treats enabled as optional.
  // Any other value (string, number, etc.) is rejected.
  if (!(body.enabled === true || body.enabled === false || body.enabled === null || body.enabled === undefined)) {
    return NextResponse.json(
      { ok: false, code: 'peer_programming_invalid_payload', message: 'enabled must be true, false, or null.' },
      { status: 400 },
    );
  }

  // Normalize a missing key to null so an empty POST body {} clears the setting rather than erroring.
  const enabled = body.enabled ?? null;

  try {
    await setPeerProgrammingSingleOpenCohort({ actorId: gate.auth.userId, enabled });
    const mode = await resolveSingleOpenCohortMode();

    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.settings.single-open-cohort.set',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'peer_programming_settings',
      targetId: 'single_open_cohort_enabled',
      metadata: { requested: enabled, effective: mode.enabled, source: mode.source },
    });

    // Same dual shape as GET: flat fields per the contract plus the nested `mode` the web
    // admin shell reads.
    return NextResponse.json({ ok: true, ...mode, mode }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'admin_single_open_cohort_set' });
    return peerProgrammingErrorResponse(error, 'Single-open-cohort setting update unavailable.');
  }
}
