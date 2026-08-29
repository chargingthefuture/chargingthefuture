import { NextResponse } from 'next/server';
import { getSkillUpWalletView } from 'lib/skill-up/repository';
import { skillUpErrorResponse, requireSkillUpReadAccess } from 'lib/skill-up/_lib';
import { reportError } from 'lib/observability/report';

// SkillUp is grant-only: this endpoint returns the signed-in user's balance
// plus a read-only history of credits earned/granted through SkillUp.
// It never exposes any action that spends or deducts ServiceCredits.
export async function GET() {
  const gate = await requireSkillUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const wallet = await getSkillUpWalletView(gate.auth.userId);
    return NextResponse.json({ ok: true, wallet });
  } catch (error) {
    reportError(error, { area: 'skill-up', op: 'wallet' });
    return skillUpErrorResponse(error, 'Wallet view unavailable.');
  }
}
