import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationAdminAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { evaluateRateLimitCommand, insertFoundationAudit } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

type EvaluatePayload = { userId?: string; commandName?: string; limit?: number; windowSeconds?: number };

type NormalizedEvaluatePayload = { userId: string; commandName: string; limit: number; windowSeconds: number };

// Normalize the request body: trim the identifiers and apply the default limit (20) and window (60s)
// when a caller omits or mistypes them.
function normalizeEvaluatePayload(payload: EvaluatePayload): NormalizedEvaluatePayload {
  return {
    userId: payload.userId?.trim() ?? '',
    commandName: payload.commandName?.trim() ?? '',
    limit: Number.isInteger(payload.limit) ? Number(payload.limit) : 20,
    windowSeconds: Number.isInteger(payload.windowSeconds) ? Number(payload.windowSeconds) : 60,
  };
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let payload: EvaluatePayload = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  const { userId, commandName, limit, windowSeconds } = normalizeEvaluatePayload(payload);

  if (!userId || !commandName) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'userId and commandName are required.' },
      { status: 400 },
    );
  }

  try {
    const evaluation = await evaluateRateLimitCommand({ userId, commandName, limit, windowSeconds });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.safeguards.rate_limit.evaluate',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'rate_limit',
      targetId: userId,
      metadata: { commandName, ...evaluation },
    });

    return NextResponse.json({ ok: true, ...evaluation }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'admin_rate_limits_evaluate' });
    console.error('[Foundation] Rate-limit evaluation failed:', error);
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Rate-limit evaluation unavailable.' },
      { status: 503 },
    );
  }
}
