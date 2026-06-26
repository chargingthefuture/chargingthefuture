import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import {
  getOwnProfile,
  insertWorkforceAdminAudit,
  insertWorkforceDeletionEvent,
  softDeleteOwnProfile,
} from 'lib/workforce/repository';
import { logWorkforceAudit, WORKFORCE_AUDIT_WORKSPACE } from 'lib/workforce/audit';
import { reportError } from 'lib/observability/report';

// Read-only profile (owner decision 2026-06-16, reaffirmed): the occupation/skill section is a live
// view of the member's own claimed Directory profile, and the availability/work preferences and the
// service_deleted_at marker are read from workforce_user_extension. There is intentionally no profile
// update path. The only mutation here is the compliance delete:
//   - DELETE service-scoped soft delete: reset preferences + set service_deleted_at, retain
//            workforce_recruited_events (workforce.profile.delete)
// Each handler enforces profile ownership (a member may only act on their own profile, keyed by the
// authenticated user id) and emits the contract's audit events. The delete also requires the CSRF
// confirmation header.

function readRequestTraceIds(request: Request): { requestId: string | null; traceId: string | null } {
  return {
    requestId: request.headers.get('x-request-id'),
    traceId: request.headers.get('x-trace-id'),
  };
}

export async function GET(request: Request) {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { requestId, traceId } = readRequestTraceIds(request);

  try {
    const profile = await getOwnProfile(gate.auth.userId);

    // workforce.profile.fetch audit (evidence: roleCheck = the read-access gate passed,
    // profileOwnershipCheck = the profile is keyed to the caller's own user id).
    logWorkforceAudit({
      actorId: gate.auth.userId,
      command: 'workforce.profile.fetch',
      status: 'allow',
      reason: 'profile_owner_read',
      targetType: 'profile',
      targetId: gate.auth.userId,
      result: 'success',
      errorCategory: null,
      requestId,
      traceId,
      targetContext: {
        workspaceId: WORKFORCE_AUDIT_WORKSPACE,
        userId: gate.auth.userId,
      },
      metadata: {
        roleCheck: 'pass',
        profileOwnershipCheck: 'pass',
        profilePresent: profile !== null,
      },
    });

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'profile' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch profile.' },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { requestId, traceId } = readRequestTraceIds(request);
  // Capture the request time up front so the deletion event can record a real requested_at distinct
  // from the processed_at the database stamps when the row is written.
  const requestedAt = new Date();
  const requestedAtIso = requestedAt.toISOString();

  try {
    const deleted = await softDeleteOwnProfile(gate.auth.userId);
    if (!deleted) {
      logWorkforceAudit({
        actorId: gate.auth.userId,
        command: 'workforce.profile.delete',
        status: 'deny',
        reason: 'profile_not_found',
        targetType: 'profile',
        targetId: gate.auth.userId,
        result: 'failure',
        errorCategory: 'not_found',
        requestId,
        traceId,
        targetContext: { workspaceId: WORKFORCE_AUDIT_WORKSPACE, userId: gate.auth.userId },
        metadata: { roleCheck: 'pass', profileOwnershipCheck: 'fail', csrfCheck: 'pass' },
      });
      return NextResponse.json(
        { ok: false, code: WORKFORCE_ERROR_CODE.notFound, message: 'No workforce profile to delete.' },
        { status: 404 },
      );
    }

    // Service-scoped deletion event (deletion contract section 8). workforce_recruited_events and
    // workforce_admin_audit_trail are retained per section 5 — the soft delete only resets the
    // extension preferences and sets service_deleted_at.
    await insertWorkforceDeletionEvent({
      userId: gate.auth.userId,
      scope: 'service',
      result: 'completed',
      requestedAt,
      requestId,
      traceId,
    });

    await insertWorkforceAdminAudit({
      actorId: gate.auth.userId,
      command: 'workforce.profile.delete',
      policyStatus: 'allow',
      reason: 'profile_owner_delete',
      targetType: 'profile',
      targetId: gate.auth.userId,
      metadata: { scope: 'service', recruitedEventsRetained: true },
    });

    logWorkforceAudit({
      actorId: gate.auth.userId,
      command: 'workforce.profile.delete',
      status: 'allow',
      reason: 'profile_owner_delete',
      targetType: 'profile',
      targetId: gate.auth.userId,
      result: 'success',
      errorCategory: null,
      requestId,
      traceId,
      targetContext: { workspaceId: WORKFORCE_AUDIT_WORKSPACE, userId: gate.auth.userId },
      metadata: { roleCheck: 'pass', profileOwnershipCheck: 'pass', csrfCheck: 'pass' },
    });

    return NextResponse.json({ ok: true, status: 'completed', requestedAtIso }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'profile_delete' });

    // Record the failure so deletion-failure alerting (deletion contract section 8) has a trail.
    try {
      await insertWorkforceDeletionEvent({
        userId: gate.auth.userId,
        scope: 'service',
        result: 'failed',
        requestedAt,
        requestId,
        traceId,
      });
    } catch (logError) {
      reportError(logError, { area: 'workforce', op: 'profile_delete_event' });
    }

    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to delete profile.' },
      { status: 503 },
    );
  }
}
