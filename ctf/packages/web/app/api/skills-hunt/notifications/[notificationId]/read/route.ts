import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntSubmitAccess } from '../../../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { markNotificationRead } from 'lib/skills-hunt/repository';
import { reportError } from 'lib/observability/report';

export async function POST(request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  // Mark-read is a mutation: require an authenticated member with a username
  // (the skills_hunt_notifications scope per the access-policy contract). The
  // repository ownership filter (user_id = caller) still enforces that a member
  // can only acknowledge their own notifications.
  const gate = await requireSkillsHuntSubmitAccess();
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
