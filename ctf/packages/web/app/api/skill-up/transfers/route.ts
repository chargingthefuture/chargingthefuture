import { NextResponse } from 'next/server';
import { z } from 'zod';
import { insertSkillUpAudit, transferCreditsForSkillUp } from 'lib/skill-up/repository';
import { ensureMutationCsrf, skillUpErrorResponse, requireSkillUpReadAccess } from 'lib/skill-up/_lib';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

const transferSchema = z.object({
  recipientUserId: z.string().min(1),
  amount: z.number().positive(),
  idempotencyKey: z.string().min(3),
  reasonCode: z.string().optional(),
});

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSkillUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'skill_up_invalid_json', message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'skill_up_invalid_payload', message: 'Invalid transfer payload.', issues: parsed.error.issues }, { status: 400 });
  }

  // Block self-transfers: a user must not be able to send credits to their own account.
  if (parsed.data.recipientUserId === gate.auth.userId) {
    return NextResponse.json({ ok: false, code: 'skill_up_invalid_payload', message: 'Cannot transfer credits to yourself.' }, { status: 400 });
  }

  try {
    const transfer = await transferCreditsForSkillUp({
      actorId: gate.auth.userId,
      ...parsed.data,
    });

    await insertSkillUpAudit({
      actorId: gate.auth.userId,
      command: 'skill-up.transfer.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'transfer',
      targetId: transfer.id,
      metadata: { amount: transfer.amount, recipientUserId: transfer.recipient_user_id },
    });

    return NextResponse.json({ ok: true, transfer }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'skill-up', op: 'transfers' });
    return skillUpErrorResponse(error, 'Transfer unavailable.');
  }
}
