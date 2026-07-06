import { NextResponse } from 'next/server';
import { requireSkillsHuntReadAccess } from '../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { listAchievements } from 'lib/skills-hunt/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireSkillsHuntReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    // Self-scope enforced here: this route always reads the authenticated user's own
    // achievements via `gate.auth.userId` and never accepts a client-supplied user id, so the
    // `selfScopeOnly` guarantee in the access policy cannot be widened from the request.
    const achievements = await listAchievements(gate.auth.userId);
    return NextResponse.json({ achievements }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'achievements' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to load achievements.' },
      { status: 503 },
    );
  }
}
