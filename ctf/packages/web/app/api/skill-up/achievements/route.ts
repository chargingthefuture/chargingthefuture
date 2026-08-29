import { NextResponse } from 'next/server';
import { listAchievementsForUser } from 'lib/skill-up/repository';
import { skillUpErrorResponse, requireSkillUpReadAccess } from 'lib/skill-up/_lib';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireSkillUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const achievements = await listAchievementsForUser(gate.auth.userId);
    return NextResponse.json({ ok: true, achievements });
  } catch (error) {
    reportError(error, { area: 'skill-up', op: 'achievements' });
    return skillUpErrorResponse(error, 'Achievements unavailable.');
  }
}
