import { NextResponse } from 'next/server';
import { getLevelUpWalletView } from 'lib/level-up/repository';
import { levelUpErrorResponse, requireLevelUpReadAccess } from 'lib/level-up/_lib';
import { reportError } from 'lib/observability/report';

// LevelUp is grant-only: this endpoint returns the signed-in user's balance
// plus a read-only history of credits earned/granted through LevelUp.
// It never exposes any action that spends or deducts ServiceCredits.
export async function GET() {
  const gate = await requireLevelUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const wallet = await getLevelUpWalletView(gate.auth.userId);
    return NextResponse.json({ ok: true, wallet });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'wallet' });
    return levelUpErrorResponse(error, 'Wallet view unavailable.');
  }
}
