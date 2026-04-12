import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationAdminAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { evaluateRateLimitCommand, insertFoundationAudit } from 'lib/foundation/repository';

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let payload: { userId?: string; commandName?: string; limit?: number; windowSeconds?: number } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  const userId = payload.userId?.trim() ?? '';
  const commandName = payload.commandName?.trim() ?? '';
  const limit = Number.isInteger(payload.limit) ? Number(payload.limit) : 20;
  const windowSeconds = Number.isInteger(payload.windowSeconds) ? Number(payload.windowSeconds) : 60;

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
    console.error('[Foundation] Rate-limit evaluation failed:', error);
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Rate-limit evaluation unavailable.' },
      { status: 503 },
    );
  }
}
