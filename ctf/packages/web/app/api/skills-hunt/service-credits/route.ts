import { NextResponse } from 'next/server';
import { requireSkillsHuntReadAccess, ensureMutationCsrf } from '../_lib';
import { createTransfer } from 'lib/service-credits/repository';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import type { SkillsHuntServiceCreditsTransactionInput } from 'lib/skills-hunt/types';

export async function POST(request: Request) {
  const gate = await requireSkillsHuntReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let input: SkillsHuntServiceCreditsTransactionInput & { idempotencyKey?: string };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid JSON.' }, { status: 400 });
  }

  if (!input.toUserId || typeof input.amount !== 'number' || input.amount <= 0) {
    return NextResponse.json({ ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid payload.' }, { status: 400 });
  }

  try {
    const idempotencyKey =
      typeof input.idempotencyKey === 'string' && input.idempotencyKey.trim().length > 0
        ? input.idempotencyKey.trim()
        : `skills-hunt-${gate.auth.userId}-${Date.now()}`;

    const tx = await createTransfer({
      senderUserId: gate.auth.userId,
      recipientUserId: input.toUserId,
      amount: input.amount,
      idempotencyKey,
      originPlugin: 'skills-hunt',
      reasonCode: 'skills-hunt.transfer',
    });

    return NextResponse.json({ ok: true, transaction: tx }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'send_service_credits', extra: { userId: gate.auth.userId } });
    return NextResponse.json({ ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to send service credits.' }, { status: 503 });
  }
}
