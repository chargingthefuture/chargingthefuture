import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireServiceCreditsAdminAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { burnCredits, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type BurnBody = {
  targetUserId?: string;
  amount?: number;
  burnReason?: string;
  governanceTicketId?: string;
  idempotencyKey?: string;
};

type BurnInput = {
  targetUserId: string;
  amount: number;
  burnReason: string;
  governanceTicketId: string;
  idempotencyKey: string;
};

function validateBurnBody(body: BurnBody): { error: NextResponse } | { data: BurnInput } {
  if (!body.targetUserId || typeof body.amount !== 'number' || !(body.amount > 0) || !Number.isFinite(body.amount) || !body.burnReason || !body.governanceTicketId || !body.idempotencyKey) {
    return {
      error: NextResponse.json(
        { ok: false, code: 'service_credits_invalid_payload', message: 'targetUserId, amount, burnReason, governanceTicketId, and idempotencyKey are required.' },
        { status: 400 },
      ),
    };
  }

  return {
    data: {
      targetUserId: body.targetUserId,
      amount: body.amount,
      burnReason: body.burnReason,
      governanceTicketId: body.governanceTicketId,
      idempotencyKey: body.idempotencyKey,
    },
  };
}

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
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: `Invalid JSON body: ${failureReason(error)}` }, { status: 400 });
  }

  const validation = validateBurnBody(body);
  if ('error' in validation) {
    return validation.error;
  }
  const input = validation.data;

  try {
    const burn = await burnCredits({
      actorId: gate.auth.userId,
      targetUserId: input.targetUserId,
      amount: input.amount,
      burnReason: input.burnReason,
      governanceTicketId: input.governanceTicketId,
      idempotencyKey: input.idempotencyKey,
    });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.governance.burn',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'governance_event',
      targetId: burn.governanceEventId,
      metadata: { targetUserId: input.targetUserId, amount: input.amount, governanceTicketId: input.governanceTicketId },
    });

    return NextResponse.json({ ok: true, burn }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'admin_governance_burns' });
    return serviceCreditsErrorResponse(error, 'Governance burn unavailable.');
  }
}
