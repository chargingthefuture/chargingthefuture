import { NextResponse } from 'next/server';
import { collectTreasuryFee, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { ensureMutationCsrf, requireServiceCreditsAdminAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';

type TreasuryFeeBody = {
  sourceUserId?: string;
  treasuryUserId?: string;
  amount?: number;
  feeReasonCode?: string;
  originPlugin?: string;
  idempotencyKey?: string;
};

type TreasuryFeeInput = {
  sourceUserId: string;
  treasuryUserId: string;
  amount: number;
  feeReasonCode: string;
  originPlugin: string;
  idempotencyKey: string;
};

function validateTreasuryFeeBody(
  body: TreasuryFeeBody,
): { error: NextResponse } | { data: TreasuryFeeInput } {
  if (
    !body.sourceUserId
    || !body.treasuryUserId
    || typeof body.amount !== 'number'
    || !(body.amount > 0)
    || !Number.isFinite(body.amount)
    || !body.feeReasonCode
    || !body.originPlugin
    || !body.idempotencyKey
  ) {
    return {
      error: NextResponse.json(
        { ok: false, code: 'service_credits_invalid_payload', message: 'sourceUserId, treasuryUserId, amount, feeReasonCode, originPlugin, and idempotencyKey are required.' },
        { status: 400 },
      ),
    };
  }

  return {
    data: {
      sourceUserId: body.sourceUserId,
      treasuryUserId: body.treasuryUserId,
      amount: body.amount,
      feeReasonCode: body.feeReasonCode,
      originPlugin: body.originPlugin,
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

  let body: TreasuryFeeBody;
  try {
    body = (await request.json()) as TreasuryFeeBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  const validation = validateTreasuryFeeBody(body);
  if ('error' in validation) {
    return validation.error;
  }
  const input = validation.data;

  try {
    const collection = await collectTreasuryFee({
      actorId: gate.auth.userId,
      sourceUserId: input.sourceUserId,
      treasuryUserId: input.treasuryUserId,
      amount: input.amount,
      feeReasonCode: input.feeReasonCode,
      originPlugin: input.originPlugin,
      idempotencyKey: input.idempotencyKey,
    });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.treasury.fee.collect',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'treasury_event',
      targetId: collection.treasuryEventId,
      metadata: {
        amount: input.amount,
        sourceUserId: input.sourceUserId,
        treasuryUserId: input.treasuryUserId,
        transferId: collection.transferId,
      },
    });

    return NextResponse.json({ ok: true, collection }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'admin_treasury_fees_collect' });
    return serviceCreditsErrorResponse(error, 'Treasury fee collection unavailable.');
  }
}
