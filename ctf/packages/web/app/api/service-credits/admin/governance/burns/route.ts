import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireServiceCreditsAdminAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';
import { burnCredits, insertServiceCreditsAudit } from 'lib/service-credits/repository';

type BurnBody = {
  targetUserId?: string;
  amount?: number;
  burnReason?: string;
  governanceTicketId?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireServiceCreditsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: BurnBody;
  try {
    body = (await request.json()) as BurnBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.targetUserId || typeof body.amount !== 'number' || !body.burnReason || !body.governanceTicketId || !body.idempotencyKey) {
    return NextResponse.json(
      { ok: false, code: 'service_credits_invalid_payload', message: 'targetUserId, amount, burnReason, governanceTicketId, and idempotencyKey are required.' },
      { status: 400 },
    );
  }

  try {
    const burn = await burnCredits({
      actorId: gate.auth.userId,
      targetUserId: body.targetUserId,
      amount: body.amount,
      burnReason: body.burnReason,
      governanceTicketId: body.governanceTicketId,
      idempotencyKey: body.idempotencyKey,
    });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.governance.burn',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'governance_event',
      targetId: burn.governanceEventId,
      metadata: { targetUserId: body.targetUserId, amount: body.amount, governanceTicketId: body.governanceTicketId },
    });

    return NextResponse.json({ ok: true, burn }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'post_governance_burn', extra: { userId: gate.auth.userId, targetUserId: body.targetUserId } });
    return serviceCreditsErrorResponse(error, 'Governance burn unavailable.');
  }
}
