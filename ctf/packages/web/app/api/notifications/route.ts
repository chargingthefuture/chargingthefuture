import { NextResponse } from 'next/server';
import { requireNotificationsAccess } from './_lib';
import { countUnreadNotifications, listNotifications } from 'lib/notifications/repository';
import { NOTIFICATION_ERROR_CODE, NOTIFICATIONS_MAX_PAGE_SIZE, type NotificationsResponse } from 'lib/notifications/types';
import { reportError } from 'lib/observability/report';

// The member's own notifications feed (newest first) plus the current unread count. Always available
// to a signed-in member — the in-app feed is never gated by push preferences.
export async function GET(request: Request) {
  const gate = await requireNotificationsAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const limitParam = new URL(request.url).searchParams.get('limit');
  const limit = limitParam ? Number.parseInt(limitParam, 10) : NOTIFICATIONS_MAX_PAGE_SIZE;
  const safeLimit = Number.isFinite(limit) ? limit : NOTIFICATIONS_MAX_PAGE_SIZE;

  try {
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(gate.auth.userId, safeLimit),
      countUnreadNotifications(gate.auth.userId),
    ]);
    const response: NotificationsResponse = { ok: true, notifications, unreadCount };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'list' });
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.persistenceUnavailable, message: 'Unable to load notifications.' },
      { status: 503 },
    );
  }
}
