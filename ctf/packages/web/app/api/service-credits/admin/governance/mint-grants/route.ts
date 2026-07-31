import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireServiceCreditsAdminAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { insertServiceCreditsAudit, mintGrant } from 'lib/service-credits/repository';
import { reportError } from 'lib/observability/report';

type MintBody = {
  targetUserId?: string;
  amount?: number;
  grantReason?: string;
  governanceTicketId?: string;
  idempotencyKey?: string;
};

type MintInput = {
  targetUserId: string;
  amount: number;
  grantReason: string;
  governanceTicketId: string;
  idempotencyKey: string;
};

function validateMintBody(body: MintBody): { error: NextResponse } | { data: MintInput } {
  if (!body.targetUserId || typeof body.amount !== 'number' || !(body.amount > 0) || !Number.isFinite(body.amount) || !body.grantReason || !body.governanceTicketId || !body.idempotencyKey) {
    return {
      error: NextResponse.json(
        { ok: false, code: 'service_credits_invalid_payload', message: 'targetUserId, amount, grantReason, governanceTicketId, and idempotencyKey are required.' },
        { status: 400 },
      ),
    };
  }

  return {
    data: {
      targetUserId: body.targetUserId,
      amount: body.amount,
      grantReason: body.grantReason,
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

  let body: MintBody;
  try {
    body = (await request.json()) as MintBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  const validation = validateMintBody(body);
  if ('error' in validation) {
    return validation.error;
  }
  const input = validation.data;

  try {
    const grant = await mintGrant({
      actorId: gate.auth.userId,
      targetUserId: input.targetUserId,
      amount: input.amount,
      grantReason: input.grantReason,
      governanceTicketId: input.governanceTicketId,
      idempotencyKey: input.idempotencyKey,
    });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.governance.mint.grant',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'governance_event',
      targetId: grant.governanceEventId,
      // Record the governing command-contract version so compliance review can tell which mint rules
      // applied. The audit-trail table has no version column, so it rides in metadata. Keep in step
      // with the governance.mint.grant version in SERVICE_CREDITS_PLUGIN_COMMAND_CONTRACTS.yaml.
      metadata: { commandVersion: '1.1.0', targetUserId: input.targetUserId, amount: input.amount, governanceTicketId: input.governanceTicketId },
    });

    return NextResponse.json({ ok: true, grant }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'admin_governance_mint_grants' });
    return serviceCreditsErrorResponse(error, 'Governance mint grant unavailable.');
  }
}
