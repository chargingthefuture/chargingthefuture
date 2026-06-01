import { NextResponse } from 'next/server';
import { insertServiceCreditsAudit, refundEscrow } from 'lib/service-credits/repository';
import { ensureMutationCsrf, requireServiceCreditsReadAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';

type EscrowParams = {
  params: Promise<{ escrowId: string }>;
};

type RefundBody = {
  refundReason?: string;
  originPlugin?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request, context: EscrowParams) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireServiceCreditsReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { escrowId } = await context.params;

  let body: RefundBody;
  try {
    body = (await request.json()) as RefundBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.refundReason || !body.originPlugin || !body.idempotencyKey) {
    return NextResponse.json(
      { ok: false, code: 'service_credits_invalid_payload', message: 'refundReason, originPlugin, and idempotencyKey are required.' },
      { status: 400 },
    );
  }

  try {
    const refund = await refundEscrow({
      actorId: gate.auth.userId,
      escrowId,
      refundReason: body.refundReason,
      originPlugin: body.originPlugin,
      idempotencyKey: body.idempotencyKey,
    });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.escrow.refund',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'escrow',
      targetId: escrowId,
      metadata: { refundStatus: refund.refundStatus },
    });

    return NextResponse.json({ ok: true, refund }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'post_escrow_refund', extra: { userId: gate.auth.userId, escrowId } });
    return serviceCreditsErrorResponse(error, 'Escrow refund unavailable.');
  }
}
