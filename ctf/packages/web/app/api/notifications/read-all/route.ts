import { NextResponse } from 'next/server';
import { ensureNotificationsCsrf, requireNotificationsAccess } from '../_lib';
import { markAllNotificationsRead } from 'lib/notifications/repository';
import { NOTIFICATION_ERROR_CODE } from 'lib/notifications/types';
import { reportError } from 'lib/observability/report';

// Mark every unread notification for the member read in one call.
export async function POST(request: Request) {
  const gate = await requireNotificationsAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureNotificationsCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  try {
    const marked = await markAllNotificationsRead(gate.auth.userId);
    return NextResponse.json({ ok: true, marked }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'read_all' });
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.persistenceUnavailable, message: 'Unable to mark notifications read.' },
      { status: 503 },
    );
  }
}
