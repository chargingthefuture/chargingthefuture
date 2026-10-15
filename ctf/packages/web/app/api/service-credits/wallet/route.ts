import { NextResponse } from 'next/server';
import { requireServiceCreditsReadAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { getMemberCreditStanding, getOrCreateWallet, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireServiceCreditsReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let wallet: Awaited<ReturnType<typeof getOrCreateWallet>>;
  let creditStanding: Awaited<ReturnType<typeof getMemberCreditStanding>>;
  try {
    wallet = await getOrCreateWallet(gate.auth.userId);
    // The member's own mutual-credit line, carried with the balance so the wallet can state how far
    // below zero they may send before a send is refused. Until this shipped the number lived only on
    // the admin side and a member found their floor by having a send bounce. Read-only: the transfer
    // path still resolves the floor itself, so nothing here can widen or narrow what is allowed.
    creditStanding = await getMemberCreditStanding(gate.auth.userId);
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'wallet_get' });
    return serviceCreditsErrorResponse(error, 'Your wallet could not be loaded right now. Try again in a moment.');
  }

  // Audit obligations from the ServiceCredits audit contract:
  //  - `wallet.create` (purpose: wallet_lifecycle) on first-time provisioning only.
  //  - `wallet.balance.get` (purpose: balance_visibility) on every balance read.
  // Both are recorded best-effort so an audit-write hiccup never blocks the member's balance read,
  // but a failed write is reported so a broken audit table is noticed.
  try {
    if (wallet.created) {
      await insertServiceCreditsAudit({
        actorId: gate.auth.userId,
        command: 'service-credits.wallet.create',
        policyStatus: 'allow',
        reason: 'ok',
        targetType: 'wallet',
        targetId: wallet.userId,
      });
    }
    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.wallet.balance.get',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'wallet',
      targetId: wallet.userId,
    });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'wallet_audit' });
  }

  return NextResponse.json({ ok: true, wallet: { ...wallet, ...creditStanding } }, { status: 200 });
}
