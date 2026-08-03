import { NextResponse } from 'next/server';
import { setWalletFrozen, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { ensureMutationCsrf, requireServiceCreditsAdminAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type WalletStatusBody = {
  targetUserId?: string;
  frozen?: boolean;
  reason?: string;
};

// Admin-only: freeze or unfreeze a member's wallet. A frozen wallet cannot spend on either rail —
// the trust & safety lever for a risk-flagged account, distinct from the mutual-credit limit.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireServiceCreditsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: WalletStatusBody;
  try {
    body = (await request.json()) as WalletStatusBody;
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: `Invalid JSON body: ${failureReason(error)}` }, { status: 400 });
  }

  if (!body.targetUserId || typeof body.frozen !== 'boolean') {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_payload', message: 'targetUserId and frozen are required.' }, { status: 400 });
  }

  try {
    const result = await setWalletFrozen({
      actorId: gate.auth.userId,
      targetUserId: body.targetUserId,
      frozen: body.frozen,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.wallet-status.set',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'wallet',
      targetId: result.targetUserId,
      metadata: { frozen: result.frozen },
    });

    return NextResponse.json({ ok: true, walletStatus: result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'admin-wallet-status' });
    return serviceCreditsErrorResponse(error, 'Could not update wallet status.');
  }
}
