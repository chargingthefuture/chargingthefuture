import { NextResponse } from 'next/server';
import { createEscrowHold, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { ensureMutationCsrf, requireServiceCreditsServiceAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';

type EscrowHoldBody = {
  escrowId?: string;
  sourceUserId?: string;
  amount?: number;
  originPlugin?: string;
  releasePolicy?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireServiceCreditsServiceAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: EscrowHoldBody;
  try {
    body = (await request.json()) as EscrowHoldBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (
    !body.sourceUserId
    || typeof body.amount !== 'number'
    || !(body.amount > 0)
    || !Number.isFinite(body.amount)
    || !body.originPlugin
    || !body.releasePolicy
    || !body.idempotencyKey
  ) {
    return NextResponse.json(
      { ok: false, code: 'service_credits_invalid_payload', message: 'sourceUserId, amount, originPlugin, releasePolicy, and idempotencyKey are required.' },
      { status: 400 },
    );
  }

  try {
    const escrow = await createEscrowHold({
      actorId: gate.auth.userId,
      escrowId: typeof body.escrowId === 'string' ? body.escrowId : undefined,
      sourceUserId: body.sourceUserId,
      amount: body.amount,
      originPlugin: body.originPlugin,
      releasePolicy: body.releasePolicy,
      idempotencyKey: body.idempotencyKey,
    });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.escrow.hold.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'escrow',
      targetId: escrow.escrowId,
      metadata: { heldAmount: escrow.heldAmount, holdStatus: escrow.holdStatus, originPlugin: body.originPlugin },
    });

    return NextResponse.json({ ok: true, escrow }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'escrows' });
    return serviceCreditsErrorResponse(error, 'Escrow hold unavailable.');
  }
}
