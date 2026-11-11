import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';
import { sendWebPushToUser } from './push';
import { getUserInterfaceVersion } from 'lib/account/ui-preferences-repository';
import { isSeMinuteOfDay, seInQuietHours, seNotifyGroup, type SeInterfaceVersion, type SeNotifyGroup, type SeQuietHours } from '@ctf/shared';
import { DELETED_MEMBER_PLACEHOLDER } from 'lib/account/deletion-registry';
import {
  isNotificationCategory,
  NOTIFICATIONS_MAX_PAGE_SIZE,
  type Notification,
  type NotificationCategory,
  type NotificationInput,
  type NotificationPreferences,
} from './types';

type NotificationRow = {
  id: string;
  source_plugin: string;
  notification_type: string;
  category: string;
  summary: string;
  link_path: string | null;
  target_ref: string | null;
  read_at: Date | null;
  created_at: Date;
};

// Deep link for a notification. Producers set link_path directly, but the earliest Commons rows were
// written before deep links existed and stored the bare '/'. Those rows still carry the post id in
// target_ref, so a reply/mention is upgraded to its per-message deep link on read — no backfill
// migration needed. Newer rows already carry the right link and pass through unchanged.
function resolveLinkPath(row: NotificationRow): string | null {
  const stored = row.link_path ?? null;
  const isBare = stored === null || stored === '' || stored === '/';
  if (
    isBare &&
    row.target_ref &&
    (row.notification_type === 'commons.reply' || row.notification_type === 'commons.mention')
  ) {
    return `/?post=${encodeURIComponent(row.target_ref)}`;
  }
  return stored;
}

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    sourcePlugin: row.source_plugin,
    notificationType: row.notification_type,
    // The column is constrained by producers, but fall back to 'activity' if an unknown value slips in.
    category: isNotificationCategory(row.category) ? row.category : 'activity',
    summary: row.summary,
    linkPath: resolveLinkPath(row),
    targetRef: row.target_ref,
    isRead: row.read_at !== null,
    createdAtIso: row.created_at.toISOString(),
  };
}

// Record one notification for one recipient. Deduped on (user_id, notification_type, target_ref) via
// a partial unique index, so re-emitting the same event is a no-op (returns null). A null targetRef
// is never deduped (the guard index only covers non-null target_ref). Producers call this; it is not
// exposed over HTTP. Best-effort by contract — callers should not let a notification failure break the
// underlying action, so wrap the call and swallow errors at the call site.
export async function createNotification(input: NotificationInput): Promise<string | null> {
  const userId = input.userId.trim();
  const summary = input.summary.trim();
  if (userId.length === 0 || summary.length === 0) {
    return null;
  }
  const result = await queryDb<{ id: string }>(
    `
      INSERT INTO notifications
        (user_id, source_plugin, notification_type, category, summary, link_path, target_ref)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, notification_type, target_ref) WHERE target_ref IS NOT NULL
      DO NOTHING
      RETURNING id
    `,
    [
      userId,
      input.sourcePlugin,
      input.notificationType,
      input.category,
      summary.slice(0, 280),
      input.linkPath ?? null,
      input.targetRef ?? null,
    ],
  );
  return result.rows[0]?.id ?? null;
}

// Best-effort producer entry point: record a notification but never let a failure (or a rolled-back
// notification write) break the underlying action that triggered it. Every per-plugin emit point
// should call this — ideally after its own transaction has committed — and ignore the result.
export async function notifySafe(input: NotificationInput): Promise<void> {
  // A record whose member deleted their account carries the placeholder in their place. There is
  // nobody behind it to notify, and a row written for it would be readable by no one.
  if (input.userId.trim() === DELETED_MEMBER_PLACEHOLDER) {
    return;
  }
  let createdId: string | null = null;
  try {
    createdId = await createNotification(input);
  } catch (error) {
    reportError(error, { area: 'notifications', op: `emit_${input.notificationType}` });
    return;
  }
  // Only send a device push on a genuinely new notification — createNotification returns null when the
  // event deduped, so a re-emit of the same event never re-pings. The in-app feed row is already
  // written above regardless.
  if (!createdId) {
    return;
  }
  try {
    await maybeSendDevicePush(input);
  } catch (error) {
    reportError(error, { area: 'notifications', op: `push_${input.notificationType}` });
  }
}

// Category → the matching 3.0 device-push opt-in field.
function isCategoryPushEnabled(category: NotificationCategory, prefs: NotificationPreferences): boolean {
  if (category === 'safety') return prefs.pushSafety;
  if (category === 'activity') return prefs.pushActivity;
  return prefs.pushCommunity;
}

const GROUP_FIELD: Record<SeNotifyGroup, 'pushReplies' | 'pushRooms' | 'pushOther'> = {
  replies: 'pushReplies',
  rooms: 'pushRooms',
  other: 'pushOther',
};

// Whether this notification may ping the member's devices now. A member on 3.1 chose by the Settings
// rows, a member on 3.0 by the three categories; quiet hours hold every ping either way.
export function shouldPushNow(
  input: Pick<NotificationInput, 'category' | 'notificationType'>,
  prefs: NotificationPreferences,
  interfaceVersion: SeInterfaceVersion,
  now: Date,
): boolean {
  const opted =
    interfaceVersion === '3.1' ? prefs[GROUP_FIELD[seNotifyGroup(input.notificationType)]] : isCategoryPushEnabled(input.category, prefs);
  return opted && !seInQuietHours(prefs.quiet, now);
}

// Send a device push for a just-created notification when the recipient opted in and is outside
// their quiet hours. The in-app feed is never gated by this; only the ping is. Discreet (the default)
// sends a generic ping with no plugin name or content — safe on a shared or monitored lock screen;
// the tappable detail lives behind sign-in in the feed. `sendWebPushToUser` is itself best-effort and
// a no-op when VAPID is unconfigured, so this never throws in a way that matters.
async function maybeSendDevicePush(input: NotificationInput): Promise<void> {
  const [prefs, interfaceVersion] = await Promise.all([getNotificationPreferences(input.userId), getUserInterfaceVersion(input.userId)]);
  if (!shouldPushNow(input, prefs, interfaceVersion, new Date())) {
    return;
  }
  const payload = prefs.discreetPush
    ? { title: 'Skills Economy', body: 'You have a new update.', data: { path: input.linkPath ?? '/' } }
    : { title: 'Skills Economy', body: input.summary, data: { path: input.linkPath ?? '/' } };
  await sendWebPushToUser(input.userId, payload);
}

export async function listNotifications(userId: string, limit: number): Promise<Notification[]> {
  const pageSize = Math.min(Math.max(1, limit), NOTIFICATIONS_MAX_PAGE_SIZE);
  const result = await queryDb<NotificationRow>(
    `
      SELECT id, source_plugin, notification_type, category, summary, link_path, target_ref, read_at, created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [userId, pageSize],
  );
  return result.rows.map(mapNotification);
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const result = await queryDb<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
    [userId],
  );
  return Number.parseInt(result.rows[0]?.count ?? '0', 10);
}

// Mark one notification read, scoped to the owner so a member can only mark their own. Returns false
// when no matching unread/owned row exists (already read is treated as success — idempotent).
export async function markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
  const result = await queryDb<{ id: string }>(
    `
      UPDATE notifications
      SET read_at = COALESCE(read_at, NOW())
      WHERE id = $1::uuid AND user_id = $2
      RETURNING id
    `,
    [notificationId, userId],
  );
  return result.rows.length > 0;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await queryDb<{ id: string }>(
    `
      UPDATE notifications
      SET read_at = NOW()
      WHERE user_id = $1 AND read_at IS NULL
      RETURNING id
    `,
    [userId],
  );
  return result.rows.length;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  pushSafety: false,
  pushActivity: false,
  pushCommunity: false,
  discreetPush: true,
  pushReplies: false,
  pushRooms: false,
  pushOther: false,
  quiet: null,
};

type PreferencesRow = {
  push_safety: boolean;
  push_activity: boolean;
  push_community: boolean;
  discreet_push: boolean;
  push_replies: boolean;
  push_rooms: boolean;
  push_other: boolean;
  quiet_start_minute: number | null;
  quiet_end_minute: number | null;
  quiet_time_zone: string | null;
};

function readQuiet(row: PreferencesRow): SeQuietHours | null {
  const { quiet_start_minute: start, quiet_end_minute: end, quiet_time_zone: zone } = row;
  return isSeMinuteOfDay(start) && isSeMinuteOfDay(end) && zone ? { startMinute: start, endMinute: end, timeZone: zone } : null;
}

// Read a member's device-push preferences. A member with no row yet gets the safe defaults
// (all push off, discreet on, no quiet hours) — the in-app feed does not depend on this.
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const result = await queryDb<PreferencesRow>(
    `
      SELECT push_safety, push_activity, push_community, discreet_push, push_replies, push_rooms, push_other,
             quiet_start_minute, quiet_end_minute, quiet_time_zone
      FROM notification_preferences
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  const row = result.rows[0];
  if (!row) {
    return { ...DEFAULT_PREFERENCES };
  }
  return {
    pushSafety: row.push_safety,
    pushActivity: row.push_activity,
    pushCommunity: row.push_community,
    discreetPush: row.discreet_push,
    pushReplies: row.push_replies,
    pushRooms: row.push_rooms,
    pushOther: row.push_other,
    quiet: readQuiet(row),
  };
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  const quiet = preferences.quiet;
  await queryDb(
    `
      INSERT INTO notification_preferences (user_id, push_safety, push_activity, push_community, discreet_push,
        push_replies, push_rooms, push_other, quiet_start_minute, quiet_end_minute, quiet_time_zone, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        push_safety = EXCLUDED.push_safety,
        push_activity = EXCLUDED.push_activity,
        push_community = EXCLUDED.push_community,
        discreet_push = EXCLUDED.discreet_push,
        push_replies = EXCLUDED.push_replies,
        push_rooms = EXCLUDED.push_rooms,
        push_other = EXCLUDED.push_other,
        quiet_start_minute = EXCLUDED.quiet_start_minute,
        quiet_end_minute = EXCLUDED.quiet_end_minute,
        quiet_time_zone = EXCLUDED.quiet_time_zone,
        updated_at = NOW()
    `,
    [
      userId,
      preferences.pushSafety,
      preferences.pushActivity,
      preferences.pushCommunity,
      preferences.discreetPush,
      preferences.pushReplies,
      preferences.pushRooms,
      preferences.pushOther,
      quiet?.startMinute ?? null,
      quiet?.endMinute ?? null,
      quiet?.timeZone ?? null,
    ],
  );
  return preferences;
}
