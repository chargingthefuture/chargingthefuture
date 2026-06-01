import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { insertSkillsHuntAudit, updateRound, validateRoundInput } from 'lib/skills-hunt/repository';
import type { SkillsHuntRoundInput } from 'lib/skills-hunt/types';
import { reportError } from 'lib/observability/report';

type RoundBody = Partial<SkillsHuntRoundInput>;

function toRoundInput(body: RoundBody): SkillsHuntRoundInput {
  return {
    name: typeof body.name === 'string' ? body.name : '',
    description: typeof body.description === 'string' ? body.description : null,
    status: body.status === 'active' || body.status === 'closed' || body.status === 'archived' ? body.status : 'draft',
    startsAtIso: typeof body.startsAtIso === 'string' ? body.startsAtIso : new Date().toISOString(),
    endsAtIso: typeof body.endsAtIso === 'string' ? body.endsAtIso : new Date(Date.now() + 86400000).toISOString(),
    scoringConfig: body.scoringConfig && typeof body.scoringConfig === 'object' ? body.scoringConfig : {},
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

  const input = toRoundInput(body);
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
