import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAdjustCredits, insertLevelUpAudit } from 'lib/level-up/repository';
import { ensureMutationCsrf, levelUpErrorResponse, requireLevelUpAdminAccess } from 'lib/level-up/_lib';
import { reportError } from 'lib/observability/report';

const adjustSchema = z.object({
  targetUserId: z.string().min(1),
  // A signed amount is allowed (a positive grant, or a negative correction of a mistaken grant),
  // but zero is a no-op governance event — reject it here for a clean 400 instead of relying on
  // the repository guard to throw.
  amount: z.number().refine((value) => value !== 0, { message: 'Amount must not be zero.' }),
  reason: z.string().min(1),
  governanceTicketId: z.string().min(1),
  idempotencyKey: z.string().min(3),
});

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLevelUpAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'level_up_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'level_up_invalid_payload', message: 'Invalid admin credit adjustment payload.', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const adjustment = await adminAdjustCredits({
      actorId: gate.auth.userId,
      ...parsed.data,
    });

    await insertLevelUpAudit({
      actorId: gate.auth.userId,
      command: 'level-up.admin.adjust_credits',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'wallet_adjustment',
      targetId: parsed.data.targetUserId,
      metadata: {
        amount: parsed.data.amount,
        governanceTicketId: parsed.data.governanceTicketId,
        // Structured target context per the admin.adjust_credits audit contract, which
        // requires both targetUserId and governanceTicketId in targetContext.
        targetContext: {
          targetUserId: parsed.data.targetUserId,
          governanceTicketId: parsed.data.governanceTicketId,
        },
      },
    });

    return NextResponse.json({ ok: true, adjustment }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'admin_adjust_credits' });
    return levelUpErrorResponse(error, 'Admin credit adjustment unavailable.');
  }
}
