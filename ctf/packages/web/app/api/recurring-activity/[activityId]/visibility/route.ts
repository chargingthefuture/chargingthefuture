import { NextResponse } from 'next/server';
import {
  ensureMutationCsrf,
  recurringActivityErrorResponse,
  recurringActivityMutationError,
  requireRecurringActivityAccess,
  resolveRequestId,
  resolveTraceId,
} from 'lib/recurring-activity/_lib';
import { RECURRING_ACTIVITY_ERROR_CODE } from 'lib/recurring-activity/constants';
import { setRecurringActivityVisibility } from 'lib/recurring-activity/repository';
import { logRecurringActivityAuditEvent } from 'lib/recurring-activity/audit';
import {
  RECURRING_ACTIVITY_VISIBILITY_VALUES,
  type RecurringActivityVisibility,
} from 'lib/recurring-activity/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// POST /api/recurring-activity/[activityId]/visibility — the owner sets the activity's visibility.
export async function POST(request: Request, context: unknown) {
  const { activityId } = (context as { params: { activityId: string } }).params;

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }
  const gate = await requireRecurringActivityAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: RECURRING_ACTIVITY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const visibility = body.visibility;
  if (!RECURRING_ACTIVITY_VISIBILITY_VALUES.includes(visibility as RecurringActivityVisibility)) {
    return NextResponse.json(
      {
        ok: false,
        code: RECURRING_ACTIVITY_ERROR_CODE.invalidPayload,
        message: `visibility must be one of: ${RECURRING_ACTIVITY_VISIBILITY_VALUES.join(', ')}.`,
      },
      { status: 400 },
    );
  }

  const requestId = resolveRequestId(request);
  const traceId = resolveTraceId(request);
  const userId = gate.auth.userId;

  try {
    const result = await setRecurringActivityVisibility(
      activityId,
      userId,
      visibility as RecurringActivityVisibility,
    );
    if (!result.ok) {
      await logRecurringActivityAuditEvent({
        actorUserId: userId,
        command: 'recurring-activity.visibility.update',
        policyStatus: 'deny',
        reason: result.code,
        activityId,
        requestId,
        traceId,
      }).catch((auditError) => reportError(auditError, { area: 'recurring-activity', op: 'visibility_audit' }));
      return recurringActivityMutationError(result.code, result.message);
    }
    await logRecurringActivityAuditEvent({
      actorUserId: userId,
      command: 'recurring-activity.visibility.update',
      policyStatus: 'allow',
      reason: 'owner_visibility_update',
      activityId,
      requestId,
      traceId,
      metadata: { visibility },
    });
    return NextResponse.json(
      {
        ok: true,
        activity: { ...result.activity, role: result.activity.ownerUserId === userId ? 'owner' : 'counterparty' },
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'recurring-activity', op: 'visibility' });
    return recurringActivityErrorResponse('Visibility update unavailable.');
  }
}
