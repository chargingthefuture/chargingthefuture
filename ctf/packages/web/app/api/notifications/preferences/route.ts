import { NextResponse } from 'next/server';
import { ensureNotificationsCsrf, requireNotificationsAccess } from '../_lib';
import { getNotificationPreferences, updateNotificationPreferences } from 'lib/notifications/repository';
import { NOTIFICATION_ERROR_CODE, type NotificationPreferencesResponse } from 'lib/notifications/types';
import { reportError } from 'lib/observability/report';

function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export async function GET() {
  const gate = await requireNotificationsAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const preferences = await getNotificationPreferences(gate.auth.userId);
    const response: NotificationPreferencesResponse = { ok: true, preferences };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'preferences_get' });
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.persistenceUnavailable, message: 'Unable to load preferences.' },
      { status: 503 },
    );
  }
}

// Update the member's device-push opt-ins. The in-app feed is unaffected by these; only device push
// is gated. A missing field keeps the current value (read first, then overlay the provided fields).
export async function PUT(request: Request) {
  const gate = await requireNotificationsAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureNotificationsCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  try {
    const current = await getNotificationPreferences(gate.auth.userId);
    const next = {
      pushSafety: readBool(body.pushSafety, current.pushSafety),
      pushActivity: readBool(body.pushActivity, current.pushActivity),
      pushCommunity: readBool(body.pushCommunity, current.pushCommunity),
      discreetPush: readBool(body.discreetPush, current.discreetPush),
    };
    const preferences = await updateNotificationPreferences(gate.auth.userId, next);
    const response: NotificationPreferencesResponse = { ok: true, preferences };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'preferences_update' });
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.persistenceUnavailable, message: 'Unable to save preferences.' },
      { status: 503 },
    );
  }
}
