import { NextResponse } from 'next/server';
import { requireSkillsHuntReadAccess } from '../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { getFeatureRewardCard } from 'lib/skills-hunt/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireSkillsHuntReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const card = await getFeatureRewardCard();
    if (!card) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Feature reward card not configured.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ card }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'feature_reward_card' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to load feature reward card.' },
      { status: 503 },
    );
  }
}
