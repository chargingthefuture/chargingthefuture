import { NextResponse } from 'next/server';
import { getLevelupWalletView } from 'lib/levelup/repository';
import { levelupErrorResponse, requireLevelupReadAccess } from 'lib/levelup/_lib';
import { reportError } from 'lib/observability/report';

// LevelUp is grant-only: this endpoint returns the signed-in user's balance
// plus a read-only history of credits earned/granted through LevelUp.
// It never exposes any action that spends or deducts ServiceCredits.
export async function GET() {
  const gate = await requireLevelupReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const wallet = await getLevelupWalletView(gate.auth.userId);
    return NextResponse.json({ ok: true, wallet });
  } catch (error) {
    reportError(error, { area: 'levelup', op: 'wallet' });
    return levelupErrorResponse(error, 'Wallet view unavailable.');
  }
}
