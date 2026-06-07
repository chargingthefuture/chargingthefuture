import { NextResponse } from 'next/server';
import { listAchievementsForUser } from 'lib/levelup/repository';
import { levelupErrorResponse, requireLevelupReadAccess } from 'lib/levelup/_lib';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireLevelupReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const achievements = await listAchievementsForUser(gate.auth.userId);
    return NextResponse.json({ ok: true, achievements });
  } catch (error) {
    reportError(error, { area: 'levelup', op: 'achievements' });
    return levelupErrorResponse(error, 'Achievements unavailable.');
  }
}
