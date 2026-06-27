import { NextResponse } from 'next/server';
import { applyDisputeAdjustment, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { ensureMutationCsrf, requireServiceCreditsAdminAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';

type DisputeAdjustmentBody = {
  disputeCaseId?: string;
  sourceUserId?: string;
  destinationUserId?: string;
  amount?: number;
  adjustmentReason?: string;
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

  let body: DisputeAdjustmentBody;
  try {
    body = (await request.json()) as DisputeAdjustmentBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (
    !body.disputeCaseId
    || !body.sourceUserId
    || !body.destinationUserId
    || typeof body.amount !== 'number'
    || !(body.amount > 0)
    || !Number.isFinite(body.amount)
    || !body.adjustmentReason
    || !body.idempotencyKey
  ) {
    return NextResponse.json(
      { ok: false, code: 'service_credits_invalid_payload', message: 'disputeCaseId, sourceUserId, destinationUserId, amount, adjustmentReason, and idempotencyKey are required.' },
      { status: 400 },
    );
  }

  try {
    const adjustment = await applyDisputeAdjustment({
      actorId: gate.auth.userId,
      disputeCaseId: body.disputeCaseId,
      sourceUserId: body.sourceUserId,
      destinationUserId: body.destinationUserId,
      amount: body.amount,
      adjustmentReason: body.adjustmentReason,
      idempotencyKey: body.idempotencyKey,
    });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.dispute.adjustment.apply',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'dispute_adjustment',
      targetId: adjustment.adjustmentId,
      metadata: {
        disputeCaseId: body.disputeCaseId,
        transferId: adjustment.transferId,
        amount: body.amount,
      },
    });

    return NextResponse.json({ ok: true, adjustment }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'admin_disputes_adjustments' });
    return serviceCreditsErrorResponse(error, 'Dispute adjustment unavailable.');
  }
}
