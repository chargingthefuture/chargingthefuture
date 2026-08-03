import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { insertSkillsHuntAudit, updateFeatureRewardCard, validateFeatureRewardCardInput } from 'lib/skills-hunt/repository';
import type { SkillsHuntFeatureRewardCardInput } from 'lib/skills-hunt/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type FeatureRewardCardBody = Partial<SkillsHuntFeatureRewardCardInput>;

function toInput(body: FeatureRewardCardBody): SkillsHuntFeatureRewardCardInput {
  return {
    title: typeof body.title === 'string' ? body.title : '',
    description: typeof body.description === 'string' ? body.description : '',
    ctaLabel: typeof body.ctaLabel === 'string' ? body.ctaLabel : '',
    ctaUrl: typeof body.ctaUrl === 'string' ? body.ctaUrl : '',
    isActive: body.isActive === true,
  };
}

export async function PUT(request: Request) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: FeatureRewardCardBody;
  try {
    body = (await request.json()) as FeatureRewardCardBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const input = toInput(body);
  if (!validateFeatureRewardCardInput(input)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid feature reward card payload.' },
      { status: 400 },
    );
  }

  try {
    const card = await updateFeatureRewardCard(gate.auth.userId, input);

    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.feature-reward-card.update',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'feature_reward_card',
      targetId: 'singleton',
    });

    return NextResponse.json({ ok: true, card }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_feature_reward_card' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to update feature reward card: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
