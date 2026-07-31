import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationAdminAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { getCapacityPolicy, insertFoundationAudit, updateCapacityPolicy } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireFoundationAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const policy = await getCapacityPolicy();
    return NextResponse.json({ ok: true, policy }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'admin_capacity_policy' });
    console.error('[Foundation] Capacity policy read failed:', error);
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Capacity policy unavailable.' },
      { status: 503 },
    );
  }
}

type CapacityPolicyPayload = {
  maxActiveThreadsPerUser?: number;
  maxMessagesPerMinute?: number;
  maxSearchesPerMinute?: number;
  maxQuoteTransitionsPerMinute?: number;
  maxCallDurationMinutes?: number;
  quotaState?: 'green' | 'yellow' | 'orange' | 'red';
};

type ValidatedCapacityPolicyPayload = {
  maxActiveThreadsPerUser: number;
  maxMessagesPerMinute: number;
  maxSearchesPerMinute: number;
  maxQuoteTransitionsPerMinute: number;
  maxCallDurationMinutes: number;
  quotaState: 'green' | 'yellow' | 'orange' | 'red';
};

// A full capacity policy requires every limit as an integer and a valid quota state; a partial or
// mistyped body is rejected. Returns the validated payload, or null when the body is incomplete.
function validateCapacityPolicyPayload(payload: CapacityPolicyPayload): ValidatedCapacityPolicyPayload | null {
  if (
    !Number.isInteger(payload.maxActiveThreadsPerUser)
    || !Number.isInteger(payload.maxMessagesPerMinute)
    || !Number.isInteger(payload.maxSearchesPerMinute)
    || !Number.isInteger(payload.maxQuoteTransitionsPerMinute)
    || !Number.isInteger(payload.maxCallDurationMinutes)
    || (payload.quotaState !== 'green' && payload.quotaState !== 'yellow' && payload.quotaState !== 'orange' && payload.quotaState !== 'red')
  ) {
    return null;
  }

  return payload as ValidatedCapacityPolicyPayload;
}

export async function PUT(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let payload: CapacityPolicyPayload = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  const validatedPayload = validateCapacityPolicyPayload(payload);
  if (!validatedPayload) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Full capacity policy payload is required.' },
      { status: 400 },
    );
  }

  try {
    const policy = await updateCapacityPolicy({
      actorUserId: gate.auth.userId,
      maxActiveThreadsPerUser: validatedPayload.maxActiveThreadsPerUser,
      maxMessagesPerMinute: validatedPayload.maxMessagesPerMinute,
      maxSearchesPerMinute: validatedPayload.maxSearchesPerMinute,
      maxQuoteTransitionsPerMinute: validatedPayload.maxQuoteTransitionsPerMinute,
      maxCallDurationMinutes: validatedPayload.maxCallDurationMinutes,
      quotaState: validatedPayload.quotaState,
    });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.admin.capacity.policy.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'capacity_policy',
      targetId: 'singleton',
      metadata: policy,
    });

    return NextResponse.json({ ok: true, policy }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'admin_capacity_policy' });
    console.error('[Foundation] Capacity policy update failed:', error);
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Capacity policy update unavailable.' },
      { status: 503 },
    );
  }
}
