import { NextResponse } from 'next/server';
import { listAchievementsForUser } from 'lib/level-up/repository';
import { levelUpErrorResponse, requireLevelUpReadAccess } from 'lib/level-up/_lib';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireLevelUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const achievements = await listAchievementsForUser(gate.auth.userId);
    return NextResponse.json({ ok: true, achievements });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'achievements' });
    return levelUpErrorResponse(error, 'Achievements unavailable.');
  }
}
