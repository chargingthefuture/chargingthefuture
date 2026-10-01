import { NextResponse } from 'next/server';
import { requireSkillsHuntReadAccess } from '../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { getMyTotals } from 'lib/skills-hunt/my-totals';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireSkillsHuntReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    // Self-scope enforced here: always the signed-in member's own counts via `gate.auth.userId`;
    // no user id is read from the request, so the `selfScopeOnly` policy cannot be widened.
    const totals = await getMyTotals(gate.auth.userId);
    return NextResponse.json({ totals }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'my_totals' });
    return NextResponse.json(
      {
        ok: false,
        code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable,
        message: 'Unable to load your totals because the database could not be reached. Try again shortly.',
      },
      { status: 503 },
    );
  }
}
