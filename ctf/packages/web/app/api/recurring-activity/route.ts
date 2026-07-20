import { NextResponse } from 'next/server';
import {
  ensureMutationCsrf,
  recurringActivityErrorResponse,
  requireRecurringActivityAccess,
  resolveRequestId,
  resolveTraceId,
} from 'lib/recurring-activity/_lib';
import { RECURRING_ACTIVITY_ERROR_CODE } from 'lib/recurring-activity/constants';
import {
  createRecurringActivity,
  listRecurringActivitiesForUser,
  RecurringActivityValidationError,
} from 'lib/recurring-activity/repository';
import { logRecurringActivityAuditEvent } from 'lib/recurring-activity/audit';
import {
  RECURRING_ACTIVITY_CADENCES,
  RECURRING_ACTIVITY_SECTORS,
  RECURRING_ACTIVITY_VISIBILITY_VALUES,
  type RecurringActivity,
  type RecurringActivityCadence,
  type RecurringActivitySector,
  type RecurringActivityVisibility,
} from 'lib/recurring-activity/types';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';

function badRequest(message: string) {
  return NextResponse.json(
    { ok: false, code: RECURRING_ACTIVITY_ERROR_CODE.invalidPayload, message },
    { status: 400 },
  );
}

// Attach the OTHER party's display name to each activity so the client can render "with <member>"
// without resolving ids itself. The reader is a party to every returned row, so seeing the other
// party's name is not a privacy leak.
async function withCounterpartyNames(activities: RecurringActivity[], readerUserId: string) {
  const otherIds = activities.map((a) => (a.ownerUserId === readerUserId ? a.counterpartyUserId : a.ownerUserId));
  const names = await resolveUsernames(otherIds);
  return activities.map((a) => {
    const otherId = a.ownerUserId === readerUserId ? a.counterpartyUserId : a.ownerUserId;
    return { ...a, counterpartyName: names.get(otherId) ?? null };
  });
}

// GET /api/recurring-activity — the caller's own ongoing activities (both sides), newest first.
export async function GET() {
  const gate = await requireRecurringActivityAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  try {
    const activities = await listRecurringActivitiesForUser(gate.auth.userId);
    const shaped = await withCounterpartyNames(activities, gate.auth.userId);
    return NextResponse.json({ ok: true, activities: shaped }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'recurring-activity', op: 'list' });
    return recurringActivityErrorResponse('Recurring activities unavailable.');
  }
}

// POST /api/recurring-activity — declare a new (pending) recurring activity with another member.
export async function POST(request: Request) {
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

  // The audit contract requires an allow-or-deny row for every decision, so a bad-payload 400 is
  // recorded too — not just the repository-level validation failures further down.
  const denyBadRequest = async (reason: string, message: string) => {
    await logRecurringActivityAuditEvent({
      actorUserId: userId,
      command: 'recurring-activity.create',
      policyStatus: 'deny',
      reason,
      requestId,
      traceId,
      metadata: { message },
    }).catch((auditError) => reportError(auditError, { area: 'recurring-activity', op: 'create_audit' }));
    return badRequest(message);
  };

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return denyBadRequest('invalid_json', 'Invalid JSON body.');
  }

  const counterpartyUserId = typeof body.counterpartyUserId === 'string' ? body.counterpartyUserId.trim() : '';
  const sector = body.sector;
  const currencyCode = typeof body.currencyCode === 'string' ? body.currencyCode.trim() : '';
  const cadence = body.cadence;
  const visibility = body.visibility;

  if (!counterpartyUserId) {
    return denyBadRequest('missing_counterparty', 'counterpartyUserId is required.');
  }
  if (!RECURRING_ACTIVITY_SECTORS.includes(sector as RecurringActivitySector)) {
    return denyBadRequest('invalid_sector', `sector must be one of: ${RECURRING_ACTIVITY_SECTORS.join(', ')}.`);
  }
  if (!currencyCode) {
    return denyBadRequest('missing_currency', 'currencyCode is required.');
  }
  if (!RECURRING_ACTIVITY_CADENCES.includes(cadence as RecurringActivityCadence)) {
    return denyBadRequest('invalid_cadence', `cadence must be one of: ${RECURRING_ACTIVITY_CADENCES.join(', ')}.`);
  }
  if (
    visibility !== undefined &&
    !RECURRING_ACTIVITY_VISIBILITY_VALUES.includes(visibility as RecurringActivityVisibility)
  ) {
    return denyBadRequest('invalid_visibility', `visibility must be one of: ${RECURRING_ACTIVITY_VISIBILITY_VALUES.join(', ')}.`);
  }

  let scValue: number | null | undefined;
  if (body.scValue !== undefined && body.scValue !== null && body.scValue !== '') {
    const parsed = typeof body.scValue === 'number' ? body.scValue : Number(body.scValue);
    if (!Number.isFinite(parsed)) {
      return denyBadRequest('invalid_sc_value', 'scValue must be a number.');
    }
    scValue = parsed;
  }

  try {
    const activity = await createRecurringActivity({
      ownerUserId: userId,
      counterpartyUserId,
      sector: sector as RecurringActivitySector,
      currencyCode,
      cadence: cadence as RecurringActivityCadence,
      scValue,
      visibility: visibility as RecurringActivityVisibility | undefined,
    });
    await logRecurringActivityAuditEvent({
      actorUserId: userId,
      command: 'recurring-activity.create',
      policyStatus: 'allow',
      reason: 'self_declare',
      activityId: activity.id,
      requestId,
      traceId,
      metadata: {
        sector: activity.sector,
        currencyCode: activity.currencyCode,
        cadence: activity.cadence,
        hasScValue: activity.scValue !== null,
      },
    });
    // Notify the counterparty they were named in a recurring activity to confirm or decline —
    // best-effort, deduped on the activity id.
    await notifySafe({
      userId: activity.counterpartyUserId,
      sourcePlugin: 'recurring-activity',
      notificationType: 'recurring-activity.invited',
      category: 'activity',
      summary: 'Someone recorded a recurring activity with you — confirm or decline it.',
      linkPath: '/apps/recurring-activity',
      targetRef: activity.id,
    });

    // The creator is always the owner; attach the reader-scoped role so the response matches the
    // client's required `role` field (same shape the list and mutation endpoints return).
    return NextResponse.json({ ok: true, activity: { ...activity, role: 'owner' as const } }, { status: 201 });
  } catch (error) {
    if (error instanceof RecurringActivityValidationError) {
      await logRecurringActivityAuditEvent({
        actorUserId: userId,
        command: 'recurring-activity.create',
        policyStatus: 'deny',
        reason: 'validation_failed',
        requestId,
        traceId,
        metadata: { message: error.message },
      }).catch((auditError) => reportError(auditError, { area: 'recurring-activity', op: 'create_audit' }));
      return badRequest(error.message);
    }
    reportError(error, { area: 'recurring-activity', op: 'create' });
    return recurringActivityErrorResponse('Recurring activity could not be recorded.');
  }
}
