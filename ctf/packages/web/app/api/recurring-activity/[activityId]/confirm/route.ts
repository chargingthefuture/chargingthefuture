import { NextResponse } from 'next/server';
import {
  ensureMutationCsrf,
  recurringActivityErrorResponse,
  recurringActivityMutationError,
  requireRecurringActivityAccess,
  resolveRequestId,
  resolveTraceId,
} from 'lib/recurring-activity/_lib';
import { confirmRecurringActivity } from 'lib/recurring-activity/repository';
import { logRecurringActivityAuditEvent } from 'lib/recurring-activity/audit';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';

// POST /api/recurring-activity/[activityId]/confirm — the counterparty confirms a pending activity.
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
    const result = await confirmRecurringActivity(activityId, userId);
    if (!result.ok) {
      await logRecurringActivityAuditEvent({
        actorUserId: userId,
        command: 'recurring-activity.confirm',
        policyStatus: 'deny',
        reason: result.code,
        activityId,
        requestId,
        traceId,
      }).catch((auditError) => reportError(auditError, { area: 'recurring-activity', op: 'confirm_audit' }));
      return recurringActivityMutationError(result.code, result.message);
    }
    await logRecurringActivityAuditEvent({
      actorUserId: userId,
      command: 'recurring-activity.confirm',
      policyStatus: 'allow',
      reason: 'counterparty_confirm',
      activityId,
      requestId,
      traceId,
    });
    // Notify the owner (proposer) that the other member confirmed — best-effort, deduped on the
    // activity id. Only the counterparty can confirm, so the owner is never the actor here.
    if (result.activity.ownerUserId !== userId) {
      await notifySafe({
        userId: result.activity.ownerUserId,
        sourcePlugin: 'recurring-activity',
        notificationType: 'recurring-activity.confirmed',
        category: 'activity',
        summary: 'Your recurring activity was confirmed.',
        linkPath: '/apps/recurring-activity',
        targetRef: result.activity.id,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        activity: { ...result.activity, role: result.activity.ownerUserId === userId ? 'owner' : 'counterparty' },
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'recurring-activity', op: 'confirm' });
    return recurringActivityErrorResponse('Confirmation unavailable.');
  }
}
