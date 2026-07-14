import { NextResponse } from 'next/server';
import {
  ensureMutationCsrf,
  recurringActivityErrorResponse,
  recurringActivityMutationError,
  requireRecurringActivityAccess,
  resolveRequestId,
  resolveTraceId,
} from 'lib/recurring-activity/_lib';
import { endRecurringActivity } from 'lib/recurring-activity/repository';
import { logRecurringActivityAuditEvent } from 'lib/recurring-activity/audit';
import { reportError } from 'lib/observability/report';

// POST /api/recurring-activity/[activityId]/end — either party ends an ongoing activity.
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

  const requestId = resolveRequestId(request);
  const traceId = resolveTraceId(request);
  const userId = gate.auth.userId;

  try {
    const result = await endRecurringActivity(activityId, userId);
    if (!result.ok) {
      await logRecurringActivityAuditEvent({
        actorUserId: userId,
        command: 'recurring-activity.end',
        policyStatus: 'deny',
        reason: result.code,
        activityId,
        requestId,
        traceId,
      }).catch((auditError) => reportError(auditError, { area: 'recurring-activity', op: 'end_audit' }));
      return recurringActivityMutationError(result.code, result.message);
    }
    await logRecurringActivityAuditEvent({
      actorUserId: userId,
      command: 'recurring-activity.end',
      policyStatus: 'allow',
      reason: 'party_end',
      activityId,
      requestId,
      traceId,
    });
    return NextResponse.json(
      {
        ok: true,
        activity: { ...result.activity, role: result.activity.ownerUserId === userId ? 'owner' : 'counterparty' },
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'recurring-activity', op: 'end' });
    return recurringActivityErrorResponse('Ending this activity is unavailable.');
  }
}
