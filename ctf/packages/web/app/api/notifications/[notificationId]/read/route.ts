import { NextResponse } from 'next/server';
import { ensureNotificationsCsrf, requireNotificationsAccess } from '../../_lib';
import { markNotificationRead } from 'lib/notifications/repository';
import { NOTIFICATION_ERROR_CODE } from 'lib/notifications/types';
import { reportError } from 'lib/observability/report';

type RouteParams = {
  params: Promise<{ notificationId: string }>;
};

// Mark one of the member's own notifications read. Idempotent — marking an already-read (or
// non-existent-for-this-member) one returns 404 only when nothing matched; a re-mark is a no-op success.
export async function POST(request: Request, { params }: RouteParams) {
  const gate = await requireNotificationsAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureNotificationsCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { notificationId } = await params;

  try {
    const marked = await markNotificationRead(gate.auth.userId, notificationId);
    if (!marked) {
      return NextResponse.json(
        { ok: false, code: NOTIFICATION_ERROR_CODE.notFound, message: 'Notification not found.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, notificationId }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'read' });
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.persistenceUnavailable, message: 'Unable to mark notification read.' },
      { status: 503 },
    );
  }
}
