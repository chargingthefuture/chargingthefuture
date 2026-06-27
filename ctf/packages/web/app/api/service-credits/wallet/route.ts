import { NextResponse } from 'next/server';
import { requireServiceCreditsReadAccess } from 'lib/service-credits/_lib';
import { getOrCreateWallet, insertServiceCreditsAudit } from 'lib/service-credits/repository';

export async function GET() {
  const gate = await requireServiceCreditsReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const wallet = await getOrCreateWallet(gate.auth.userId);

  // Audit obligations from the ServiceCredits audit contract:
  //  - `wallet.create` (purpose: wallet_lifecycle) on first-time provisioning only.
  //  - `wallet.balance.get` (purpose: balance_visibility) on every balance read.
  // Both are recorded best-effort so an audit-write hiccup never blocks the member's balance read.
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
  } catch {
    // Best-effort audit; the balance read still returns.
  }

  return NextResponse.json({ ok: true, wallet }, { status: 200 });
}
