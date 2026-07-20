// Coarse opt-in bucket a notification belongs to. Device push is opted in per bucket (all default
// off); the in-app feed shows every bucket regardless. Kept deliberately small so a member has three
// plain choices, not one per plugin.
export type NotificationCategory = 'safety' | 'activity' | 'community';

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = ['safety', 'activity', 'community'];

export function isNotificationCategory(value: unknown): value is NotificationCategory {
  return typeof value === 'string' && (NOTIFICATION_CATEGORIES as string[]).includes(value);
}

// One member-facing notification. `summary` is a short, neutral statement resolved when the row was
// created; `linkPath` is the in-app destination (e.g. '/apps/foundation') or null. No sensitive
// detail is stored — the row is a reference plus a display label.
export type Notification = {
  id: string;
  sourcePlugin: string;
  notificationType: string;
  category: NotificationCategory;
  summary: string;
  linkPath: string | null;
  isRead: boolean;
  createdAtIso: string;
};

// Per-member device-push opt-in. The in-app feed is never gated by these — only device push is.
export type NotificationPreferences = {
  pushSafety: boolean;
  pushActivity: boolean;
  pushCommunity: boolean;
  // Keep push text generic (no plugin name or content) on the lock screen. Default true.
  discreetPush: boolean;
};

export type NotificationsResponse = {
  ok: true;
  notifications: Notification[];
  unreadCount: number;
};

export type NotificationPreferencesResponse = {
  ok: true;
  preferences: NotificationPreferences;
};

// A single notify-worthy event to record for one recipient. Producers (per-plugin emit points) build
// this; the repository validates and inserts it, deduping on (userId, notificationType, targetRef).
export type NotificationInput = {
  userId: string;
  sourcePlugin: string;
  notificationType: string;
  category: NotificationCategory;
  summary: string;
  linkPath?: string | null;
  targetRef?: string | null;
};

export const NOTIFICATION_ERROR_CODE = {
  invalidPayload: 'NOTIFICATION_INVALID_PAYLOAD',
  notFound: 'NOTIFICATION_NOT_FOUND',
  persistenceUnavailable: 'NOTIFICATION_PERSISTENCE_UNAVAILABLE',
  csrfDenied: 'NOTIFICATION_CSRF_DENIED',
} as const;

export const NOTIFICATIONS_MAX_PAGE_SIZE = 50;
