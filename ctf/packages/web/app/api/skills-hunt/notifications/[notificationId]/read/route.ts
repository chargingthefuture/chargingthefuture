import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntReadAccess } from '../../../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { markNotificationRead } from 'lib/skills-hunt/repository';
import { reportError } from 'lib/observability/report';

export async function POST(request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  const gate = await requireSkillsHuntReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { notificationId } = await params;

  try {
    const notification = await markNotificationRead(gate.auth.userId, notificationId);
    if (!notification) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Notification not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, notification }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'notifications_notificationid_read' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to acknowledge notification.' },
      { status: 503 },
    );
  }
}
