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

  if (
    !body.sourceUserId
    || !body.treasuryUserId
    || typeof body.amount !== 'number'
    || !body.feeReasonCode
    || !body.originPlugin
    || !body.idempotencyKey
  ) {
    return NextResponse.json(
      { ok: false, code: 'service_credits_invalid_payload', message: 'sourceUserId, treasuryUserId, amount, feeReasonCode, originPlugin, and idempotencyKey are required.' },
      { status: 400 },
    );
  }

  try {
    const collection = await collectTreasuryFee({
      actorId: gate.auth.userId,
      sourceUserId: body.sourceUserId,
      treasuryUserId: body.treasuryUserId,
      amount: body.amount,
      feeReasonCode: body.feeReasonCode,
      originPlugin: body.originPlugin,
      idempotencyKey: body.idempotencyKey,
    });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.treasury.fee.collect',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'treasury_event',
      targetId: collection.treasuryEventId,
      metadata: {
        amount: body.amount,
        sourceUserId: body.sourceUserId,
        treasuryUserId: body.treasuryUserId,
        transferId: collection.transferId,
      },
    });

    return NextResponse.json({ ok: true, collection }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'admin_treasury_fees_collect' });
    return serviceCreditsErrorResponse(error, 'Treasury fee collection unavailable.');
  }
}
