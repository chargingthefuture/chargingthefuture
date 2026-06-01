import { NextResponse } from 'next/server';
import { insertServiceCreditsAudit, releaseEscrow } from 'lib/service-credits/repository';
import { ensureMutationCsrf, requireServiceCreditsReadAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';

type EscrowParams = {
  params: Promise<{ escrowId: string }>;
};

type ReleaseBody = {
  destinationUserId?: string;
  releaseReason?: string;
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

  let body: ReleaseBody;
  try {
    body = (await request.json()) as ReleaseBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.destinationUserId || !body.releaseReason || !body.originPlugin || !body.idempotencyKey) {
    return NextResponse.json(
      { ok: false, code: 'service_credits_invalid_payload', message: 'destinationUserId, releaseReason, originPlugin, and idempotencyKey are required.' },
      { status: 400 },
    );
  }

  try {
    const release = await releaseEscrow({
      actorId: gate.auth.userId,
      escrowId,
      destinationUserId: body.destinationUserId,
      releaseReason: body.releaseReason,
      originPlugin: body.originPlugin,
      idempotencyKey: body.idempotencyKey,
    });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.escrow.release',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'escrow',
      targetId: escrowId,
      metadata: { transferId: release.transferId, destinationUserId: body.destinationUserId },
    });

    return NextResponse.json({ ok: true, release }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'escrows_escrowid_release' });
    return serviceCreditsErrorResponse(error, 'Escrow release unavailable.');
  }
}
