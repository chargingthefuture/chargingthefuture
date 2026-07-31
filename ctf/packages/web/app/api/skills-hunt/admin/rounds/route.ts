import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { createRound, insertSkillsHuntAudit, listRounds, validateRoundInput } from 'lib/skills-hunt/repository';
import type { SkillsHuntRoundInput } from 'lib/skills-hunt/types';
import { reportError } from 'lib/observability/report';

type RoundBody = Partial<SkillsHuntRoundInput>;

function normalizeRoundStatus(status: SkillsHuntRoundInput['status'] | undefined): SkillsHuntRoundInput['status'] {
  return status === 'active' || status === 'closed' || status === 'archived' ? status : 'draft';
}

function toRoundInput(body: RoundBody): SkillsHuntRoundInput {
  return {
    name: typeof body.name === 'string' ? body.name : '',
    description: typeof body.description === 'string' ? body.description : null,
    status: normalizeRoundStatus(body.status),
    startsAtIso: typeof body.startsAtIso === 'string' ? body.startsAtIso : new Date().toISOString(),
    endsAtIso: typeof body.endsAtIso === 'string' ? body.endsAtIso : new Date(Date.now() + 86400000).toISOString(),
    scoringConfig: body.scoringConfig && typeof body.scoringConfig === 'object' ? body.scoringConfig : {},
    rewardCreditsPerAccept: typeof body.rewardCreditsPerAccept === 'number' ? body.rewardCreditsPerAccept : 0,
    rewardPerUserRoundCap: typeof body.rewardPerUserRoundCap === 'number' ? body.rewardPerUserRoundCap : null,
  };
}

export async function GET() {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const rounds = await listRounds(null);
    return NextResponse.json({ rounds }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_rounds' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to list rounds.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: RoundBody;
  try {
    body = (await request.json()) as RoundBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = toRoundInput(body);
  if (!validateRoundInput(input)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid round payload.' },
      { status: 400 },
    );
  }

  try {
    const round = await createRound(gate.auth.userId, input);

    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.round.create',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'round',
      targetId: round.id,
    });

    return NextResponse.json({ ok: true, round }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_rounds' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to create round.' },
      { status: 503 },
    );
  }
}
