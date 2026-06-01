import { NextResponse } from 'next/server';
import { requireSkillsHuntAdminAccess } from '../../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import { listSkillsHuntAuditEvents } from 'lib/skills-hunt/repository';

export async function GET(request: Request) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const limitRaw = Number.parseInt(new URL(request.url).searchParams.get('limit') ?? '100', 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100;

  try {
    const events = await listSkillsHuntAuditEvents(limit);
    return NextResponse.json({ events }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'list_audit_events', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch audit events.' },
      { status: 503 },
    );
  }
}
