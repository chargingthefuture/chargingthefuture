import { NextResponse } from 'next/server';
import { requireSkillsHuntReadAccess } from '../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { listNotifications } from 'lib/skills-hunt/repository';
import { reportError } from 'lib/observability/report';

export async function GET(request: Request) {
  const gate = await requireSkillsHuntReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const unreadOnly = new URL(request.url).searchParams.get('unreadOnly') === 'true';

  try {
    const notifications = await listNotifications(gate.auth.userId, unreadOnly);
    return NextResponse.json({ notifications }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'notifications' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to load notifications.' },
      { status: 503 },
    );
  }
}
