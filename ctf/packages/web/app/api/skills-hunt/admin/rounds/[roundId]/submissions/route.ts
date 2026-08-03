import { NextResponse } from 'next/server';
import { requireSkillsHuntModeratorAccess } from '../../../../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { getRound, getRoundRewardSummary, listSubmissions, parsePaginationParams } from 'lib/skills-hunt/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export async function GET(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  // Moderator (not admin) gate is deliberate: this is the moderation queue, matching the
  // review and generate-directory-profile routes that moderators also use. The access policy
  // for `skills-hunt.submission.list` is `ownershipScopeOrModerationRole`, so a moderator is
  // permitted. The reward summary is shown because a moderator's accept is what pays the scout,
  // so they need to see what a round pays and how much has been paid.
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
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to list submissions: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
