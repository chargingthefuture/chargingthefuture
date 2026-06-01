import { NextResponse } from 'next/server';
import { z } from 'zod';
import { insertLevelupAudit, transferCreditsForLevelup } from 'lib/levelup/repository';
import { ensureMutationCsrf, levelupErrorResponse, requireLevelupReadAccess } from 'lib/levelup/_lib';
import { reportError } from 'lib/observability/report';

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

  const gate = await requireLevelupReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'levelup_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'levelup_invalid_payload', message: 'Invalid transfer payload.', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const transfer = await transferCreditsForLevelup({
      actorId: gate.auth.userId,
      ...parsed.data,
    });

    await insertLevelupAudit({
      actorId: gate.auth.userId,
      command: 'levelup.transfer.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'transfer',
      targetId: transfer.id,
      metadata: { amount: transfer.amount, recipientUserId: transfer.recipient_user_id },
    });

    return NextResponse.json({ ok: true, transfer }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'levelup', op: 'post_transfer_credits', extra: { userId: gate.auth.userId } });
    return levelupErrorResponse(error, 'Transfer unavailable.');
  }
}
