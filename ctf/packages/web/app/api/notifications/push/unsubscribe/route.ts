import { NextResponse } from 'next/server';
import { ensureNotificationsCsrf, requireNotificationsAccess } from '../../_lib';
import { deletePushSubscriptionByEndpoint } from 'lib/notifications/push';
import { NOTIFICATION_ERROR_CODE } from 'lib/notifications/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Remove one device's push subscription (the member turned device alerts off, or the browser revoked
// it). Scoped to the caller so a member can only delete their own subscription.
export async function POST(request: Request) {
  const csrfDeny = ensureNotificationsCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireNotificationsAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let payload: { endpoint?: unknown };
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.invalidPayload, message: 'An endpoint is required.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
  if (!endpoint) {
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.invalidPayload, message: 'An endpoint is required.' },
      { status: 400 },
    );
  }

  try {
    await deletePushSubscriptionByEndpoint({ userId: gate.auth.userId, endpoint });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'push_unsubscribe' });
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.persistenceUnavailable, message: 'Could not update your device alerts.' },
      { status: 503 },
    );
  }
}
