import { NextResponse } from 'next/server';
import {
  ensureMutationCsrf,
  recurringActivityErrorResponse,
  requireRecurringActivityAccess,
  resolveRequestId,
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest('Invalid JSON body.');
  }

  const counterpartyUserId = typeof body.counterpartyUserId === 'string' ? body.counterpartyUserId.trim() : '';
  const sector = body.sector;
  const currencyCode = typeof body.currencyCode === 'string' ? body.currencyCode.trim() : '';
  const cadence = body.cadence;
  const visibility = body.visibility;

  if (!counterpartyUserId) {
    return badRequest('counterpartyUserId is required.');
  }
  if (!RECURRING_ACTIVITY_SECTORS.includes(sector as RecurringActivitySector)) {
    return badRequest(`sector must be one of: ${RECURRING_ACTIVITY_SECTORS.join(', ')}.`);
  }
  if (!currencyCode) {
    return badRequest('currencyCode is required.');
  }
  if (!RECURRING_ACTIVITY_CADENCES.includes(cadence as RecurringActivityCadence)) {
    return badRequest(`cadence must be one of: ${RECURRING_ACTIVITY_CADENCES.join(', ')}.`);
  }
  if (
    visibility !== undefined &&
    !RECURRING_ACTIVITY_VISIBILITY_VALUES.includes(visibility as RecurringActivityVisibility)
  ) {
    return badRequest(`visibility must be one of: ${RECURRING_ACTIVITY_VISIBILITY_VALUES.join(', ')}.`);
  }

  let scValue: number | null | undefined;
  if (body.scValue !== undefined && body.scValue !== null && body.scValue !== '') {
    const parsed = typeof body.scValue === 'number' ? body.scValue : Number(body.scValue);
    if (!Number.isFinite(parsed)) {
      return badRequest('scValue must be a number.');
    }
    scValue = parsed;
  }

  const requestId = resolveRequestId(request);
  const userId = gate.auth.userId;

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
      metadata: {
        sector: activity.sector,
        currencyCode: activity.currencyCode,
        cadence: activity.cadence,
        hasScValue: activity.scValue !== null,
      },
    });
    return NextResponse.json({ ok: true, activity }, { status: 201 });
  } catch (error) {
    if (error instanceof RecurringActivityValidationError) {
      await logRecurringActivityAuditEvent({
        actorUserId: userId,
        command: 'recurring-activity.create',
        policyStatus: 'deny',
        reason: 'validation_failed',
        requestId,
        metadata: { message: error.message },
      }).catch((auditError) => reportError(auditError, { area: 'recurring-activity', op: 'create_audit' }));
      return badRequest(error.message);
    }
    reportError(error, { area: 'recurring-activity', op: 'create' });
    return recurringActivityErrorResponse('Recurring activity could not be recorded.');
  }
}
