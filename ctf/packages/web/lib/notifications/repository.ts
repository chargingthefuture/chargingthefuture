import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';
import {
  isNotificationCategory,
  NOTIFICATIONS_MAX_PAGE_SIZE,
  type Notification,
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
  read_at: Date | null;
  created_at: Date;
};

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    sourcePlugin: row.source_plugin,
    notificationType: row.notification_type,
    // The column is constrained by producers, but fall back to 'activity' if an unknown value slips in.
    category: isNotificationCategory(row.category) ? row.category : 'activity',
    summary: row.summary,
    linkPath: row.link_path ?? null,
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
  try {
    await createNotification(input);
  } catch (error) {
    reportError(error, { area: 'notifications', op: `emit_${input.notificationType}` });
  }
}

export async function listNotifications(userId: string, limit: number): Promise<Notification[]> {
  const pageSize = Math.min(Math.max(1, limit), NOTIFICATIONS_MAX_PAGE_SIZE);
  const result = await queryDb<NotificationRow>(
    `
      SELECT id, source_plugin, notification_type, category, summary, link_path, read_at, created_at
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
};

// Read a member's device-push preferences. A member with no row yet gets the safe defaults
// (all push off, discreet on) — the in-app feed does not depend on this.
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const result = await queryDb<{
    push_safety: boolean;
    push_activity: boolean;
    push_community: boolean;
    discreet_push: boolean;
  }>(
    `
      SELECT push_safety, push_activity, push_community, discreet_push
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
  };
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  await queryDb(
    `
      INSERT INTO notification_preferences (user_id, push_safety, push_activity, push_community, discreet_push, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        push_safety = EXCLUDED.push_safety,
        push_activity = EXCLUDED.push_activity,
        push_community = EXCLUDED.push_community,
        discreet_push = EXCLUDED.discreet_push,
        updated_at = NOW()
    `,
    [userId, preferences.pushSafety, preferences.pushActivity, preferences.pushCommunity, preferences.discreetPush],
  );
  return preferences;
}
