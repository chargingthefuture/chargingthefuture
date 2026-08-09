import { NextResponse } from 'next/server';
import { createEscrowHold, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { ensureMutationCsrf, requireServiceCreditsServiceAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type EscrowHoldBody = {
  escrowId?: string;
  sourceUserId?: string;
  amount?: number;
  originPlugin?: string;
  releasePolicy?: string;
  idempotencyKey?: string;
};

type ParsedEscrowHoldRequest = {
  escrowId: string | undefined;
  sourceUserId: string;
  amount: number;
  originPlugin: string;
  releasePolicy: string;
  idempotencyKey: string;
};

// Validate/normalize the escrow-hold body. Returns the parsed request on success or a ready 400
// response on failure. Preserves the original validation checks verbatim.
function parseEscrowHoldBody(body: EscrowHoldBody): { error: NextResponse } | { data: ParsedEscrowHoldRequest } {
  if (
    !body.sourceUserId
    || typeof body.amount !== 'number'
    || !(body.amount > 0)
    || !Number.isFinite(body.amount)
    || !body.originPlugin
    || !body.releasePolicy
    || !body.idempotencyKey
  ) {
    return {
      error: NextResponse.json(
        { ok: false, code: 'service_credits_invalid_payload', message: 'sourceUserId, amount, originPlugin, releasePolicy, and idempotencyKey are required.' },
        { status: 400 },
      ),
    };
  }

  return {
    data: {
      escrowId: typeof body.escrowId === 'string' ? body.escrowId : undefined,
      sourceUserId: body.sourceUserId,
      amount: body.amount,
      originPlugin: body.originPlugin,
      releasePolicy: body.releasePolicy,
      idempotencyKey: body.idempotencyKey,
    },
  };
}

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
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  const parsed = parseEscrowHoldBody(body);
  if ('error' in parsed) {
    return parsed.error;
  }

  try {
    const escrow = await createEscrowHold({
      actorId: gate.auth.userId,
      escrowId: parsed.data.escrowId,
      sourceUserId: parsed.data.sourceUserId,
      amount: parsed.data.amount,
      originPlugin: parsed.data.originPlugin,
      releasePolicy: parsed.data.releasePolicy,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.escrow.hold.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'escrow',
      targetId: escrow.escrowId,
      metadata: { heldAmount: escrow.heldAmount, holdStatus: escrow.holdStatus, originPlugin: parsed.data.originPlugin },
    });

    return NextResponse.json({ ok: true, escrow }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'escrows' });
    return serviceCreditsErrorResponse(error, 'Escrow hold unavailable.');
  }
}
