import { NextResponse } from 'next/server';
import { requireSkillsHuntModeratorAccess } from '../../../../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { getRound, getRoundRewardSummary, listSubmissions, parsePaginationParams } from 'lib/skills-hunt/repository';
import { reportError } from 'lib/observability/report';

export async function GET(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const gate = await requireSkillsHuntModeratorAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { roundId } = await params;
  const status = new URL(request.url).searchParams.get('status');

  try {
    const pagination = parsePaginationParams(request.url);
    // Load the submission page alongside the round's reward config and the
    // running reward total so the moderation view can show what scouts are paid.
    const [result, round, rewardSummary] = await Promise.all([
      listSubmissions(roundId, status, pagination, {
        userId: gate.auth.userId,
        isModeratorOrAdmin: true,
      }),
      getRound(roundId),
      getRoundRewardSummary(roundId),
    ]);
    return NextResponse.json({ ...result, round, rewardSummary }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_rounds_roundid_submissions' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to list submissions.' },
      { status: 503 },
    );
  }
}
