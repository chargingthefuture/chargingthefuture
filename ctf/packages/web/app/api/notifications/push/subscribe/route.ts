import { NextResponse } from 'next/server';
import { ensureNotificationsCsrf, requireNotificationsAccess } from '../../_lib';
import { saveWebPushSubscription } from 'lib/notifications/push';
import { NOTIFICATION_ERROR_CODE } from 'lib/notifications/types';
import { reportError } from 'lib/observability/report';

// Save the signed-in member's Web Push subscription for one device, so their opted-in notifications can
// also ping this device. Scoped to the caller's own subscription; stored in the user-global
// push_subscriptions table (shared with Foundation call alerts) — a device subscribed once receives
// any push the member has opted into. Secrets policy: the endpoint/keys are stored, never logged.
export async function POST(request: Request) {
  const csrfDeny = ensureNotificationsCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireNotificationsAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let payload: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; userAgent?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.invalidPayload, message: 'A subscription is required.' },
      { status: 400 },
    );
  }

  const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
  const p256dh = typeof payload.keys?.p256dh === 'string' ? payload.keys.p256dh : null;
  const auth = typeof payload.keys?.auth === 'string' ? payload.keys.auth : null;
  const userAgent = typeof payload.userAgent === 'string' ? payload.userAgent.slice(0, 256) : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.invalidPayload, message: 'A complete push subscription is required.' },
      { status: 400 },
    );
  }

  try {
    await saveWebPushSubscription({ userId: gate.auth.userId, endpoint, p256dh, auth, userAgent });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'push_subscribe' });
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.persistenceUnavailable, message: 'Could not save your device alerts.' },
      { status: 503 },
    );
  }
}
