import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { getRound, insertSkillsHuntAudit, updateRound, validateRoundInput } from 'lib/skills-hunt/repository';
import type { SkillsHuntRound, SkillsHuntRoundInput } from 'lib/skills-hunt/types';
import { reportError } from 'lib/observability/report';

type RoundBody = Partial<SkillsHuntRoundInput>;

// description is tri-state: absent preserves the current value, an explicit
// string sets it, anything else clears it to null.
function mergeRoundDescription(existing: SkillsHuntRound, body: RoundBody): string | null {
  return body.description === undefined
    ? existing.description
    : typeof body.description === 'string'
      ? body.description
      : null;
}

function mergeRoundStatus(existing: SkillsHuntRound, body: RoundBody): SkillsHuntRoundInput['status'] {
  return body.status === 'draft' || body.status === 'active' || body.status === 'closed' || body.status === 'archived'
    ? body.status
    : existing.status;
}

// rewardPerUserRoundCap is tri-state like description: absent preserves, a
// number sets it, anything else clears it to null.
function mergeRoundRewardCap(existing: SkillsHuntRound, body: RoundBody): number | null {
  return body.rewardPerUserRoundCap === undefined
    ? existing.rewardPerUserRoundCap
    : typeof body.rewardPerUserRoundCap === 'number'
      ? body.rewardPerUserRoundCap
      : null;
}

// round.update is a partial update: every field is optional in the contract, so
// a body that omits a field must preserve the round's existing value rather than
// silently reset it to a default. Merge each present field over the current round.
function mergeRoundInput(existing: SkillsHuntRound, body: RoundBody): SkillsHuntRoundInput {
  return {
    name: typeof body.name === 'string' ? body.name : existing.name,
    description: mergeRoundDescription(existing, body),
    status: mergeRoundStatus(existing, body),
    startsAtIso: typeof body.startsAtIso === 'string' ? body.startsAtIso : existing.startsAtIso,
    endsAtIso: typeof body.endsAtIso === 'string' ? body.endsAtIso : existing.endsAtIso,
    scoringConfig:
      body.scoringConfig && typeof body.scoringConfig === 'object' ? body.scoringConfig : existing.scoringConfig,
    rewardCreditsPerAccept:
      typeof body.rewardCreditsPerAccept === 'number' ? body.rewardCreditsPerAccept : existing.rewardCreditsPerAccept,
    rewardPerUserRoundCap: mergeRoundRewardCap(existing, body),
  };
}

export async function PUT(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { roundId } = await params;

  let body: RoundBody;
  try {
    body = (await request.json()) as RoundBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const existing = await getRound(roundId);
  if (!existing) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.roundNotFound, message: 'Round not found.' },
      { status: 404 },
    );
  }

  const input = mergeRoundInput(existing, body);
  if (!validateRoundInput(input)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid round payload.' },
      { status: 400 },
    );
  }

  try {
    const round = await updateRound(gate.auth.userId, roundId, input);
    if (!round) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.roundNotFound, message: 'Round not found.' },
        { status: 404 },
      );
    }

    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.round.update',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'round',
      targetId: round.id,
    });

    return NextResponse.json({ ok: true, round }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_rounds_roundid' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to update round.' },
      { status: 503 },
    );
  }
}
