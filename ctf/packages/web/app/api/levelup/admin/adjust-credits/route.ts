import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAdjustCredits, insertLevelupAudit } from 'lib/levelup/repository';
import { ensureMutationCsrf, levelupErrorResponse, requireLevelupAdminAccess } from 'lib/levelup/_lib';
import { reportError } from 'lib/observability/report';

const adjustSchema = z.object({
  targetUserId: z.string().min(1),
  amount: z.number(),
  reason: z.string().min(1),
  governanceTicketId: z.string().min(1),
  idempotencyKey: z.string().min(3),
});

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLevelupAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'levelup_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'levelup_invalid_payload', message: 'Invalid admin credit adjustment payload.', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const adjustment = await adminAdjustCredits({
      actorId: gate.auth.userId,
      ...parsed.data,
    });

    await insertLevelupAudit({
      actorId: gate.auth.userId,
      command: 'levelup.admin.adjust_credits',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'wallet_adjustment',
      targetId: parsed.data.targetUserId,
      metadata: {
        amount: parsed.data.amount,
        governanceTicketId: parsed.data.governanceTicketId,
      },
    });

    return NextResponse.json({ ok: true, adjustment }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'levelup', op: 'admin_adjust_credits' });
    return levelupErrorResponse(error, 'Admin credit adjustment unavailable.');
  }
}
