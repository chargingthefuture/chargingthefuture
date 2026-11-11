import { NextResponse } from 'next/server';
import { ensureNotificationsCsrf, requireNotificationsAccess } from '../_lib';
import { getNotificationPreferences, updateNotificationPreferences } from 'lib/notifications/repository';
import { NOTIFICATION_ERROR_CODE, type NotificationPreferences, type NotificationPreferencesResponse } from 'lib/notifications/types';
import { isSeMinuteOfDay, type SeQuietHours } from '@ctf/shared';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

// Quiet hours: absent keeps the saved value, null turns them off, and `{ startMinute, endMinute,
// timeZone }` (minutes after midnight, an IANA zone name) sets them. Anything else is refused.
type QuietRead = { ok: true; quiet: SeQuietHours | null } | { ok: false };

function validZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || zone.length === 0 || zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function readQuiet(value: unknown, current: SeQuietHours | null): QuietRead {
  if (value === undefined) return { ok: true, quiet: current };
  if (value === null) return { ok: true, quiet: null };
  const quiet = typeof value === 'object' ? (value as Record<string, unknown>) : {};
  if (!isSeMinuteOfDay(quiet.startMinute) || !isSeMinuteOfDay(quiet.endMinute) || !validZone(quiet.timeZone)) return { ok: false };
  return { ok: true, quiet: { startMinute: quiet.startMinute, endMinute: quiet.endMinute, timeZone: quiet.timeZone } };
}

function nextPreferences(body: Record<string, unknown>, current: NotificationPreferences, quiet: SeQuietHours | null): NotificationPreferences {
  return {
    pushSafety: readBool(body.pushSafety, current.pushSafety),
    pushActivity: readBool(body.pushActivity, current.pushActivity),
    pushCommunity: readBool(body.pushCommunity, current.pushCommunity),
    discreetPush: readBool(body.discreetPush, current.discreetPush),
    pushReplies: readBool(body.pushReplies, current.pushReplies),
    pushRooms: readBool(body.pushRooms, current.pushRooms),
    pushOther: readBool(body.pushOther, current.pushOther),
    quiet,
  };
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

// Update the member's device-push opt-ins (the 3.0 categories and the 3.1 Settings rows) and quiet
// hours. The in-app feed is unaffected by these; only device push
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
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  try {
    const current = await getNotificationPreferences(gate.auth.userId);
    const quiet = readQuiet(body.quiet, current.quiet);
    if (!quiet.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: NOTIFICATION_ERROR_CODE.invalidPayload,
          message: 'quiet must be null, or { startMinute, endMinute, timeZone } with minutes from 0 to 1439 and a known time zone.',
        },
        { status: 400 },
      );
    }
    const preferences = await updateNotificationPreferences(gate.auth.userId, nextPreferences(body, current, quiet.quiet));
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
