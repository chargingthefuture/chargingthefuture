import { NextResponse } from 'next/server';
import { requireSkillsHuntReadAccess } from '../../../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { listAllTimeLeaderboard, listLeaderboard } from 'lib/skills-hunt/repository';
import { reportError } from 'lib/observability/report';

export async function GET(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const gate = await requireSkillsHuntReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { roundId } = await params;
  const url = new URL(request.url);
  const range = url.searchParams.get('range');

  try {
    const result = range === 'all-time'
      ? await listAllTimeLeaderboard(gate.auth.userId)
      : await listLeaderboard(roundId, gate.auth.userId);

    return NextResponse.json(
      {
        mode: 'individual',
        range: range === 'all-time' ? 'all-time' : 'round',
        roundId: range === 'all-time' ? null : roundId,
        items: result.items,
        currentUserEntry: result.currentUserEntry,
        totalCount: result.totalCount,
        generatedAtIso: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'rounds_roundid_leaderboard' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to load leaderboard.' },
      { status: 503 },
    );
  }
}
