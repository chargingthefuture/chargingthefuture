'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import type {
  Notification,
  NotificationPreferences,
  NotificationPreferencesResponse,
  NotificationsResponse,
} from '../../lib/notifications/types';
import styles from './community-shell.module.css';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload ? payload.message : 'Request failed.';
    throw new Error(typeof message === 'string' ? message : 'Request failed.');
  }
  return payload as T;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// The three plain opt-in buckets. Order and labels are member-facing.
const PUSH_TOGGLES: Array<{ key: keyof Pick<NotificationPreferences, 'pushSafety' | 'pushActivity' | 'pushCommunity'>; label: string; detail: string }> = [
  { key: 'pushSafety', label: 'Safety, rides, and calls', detail: 'LightHouse, SocketRelay, TrustTransport, Foundation' },
  { key: 'pushActivity', label: 'Your activity and credits', detail: 'ServiceCredits, SkillUp, Recurring Activity' },
  { key: 'pushCommunity', label: 'Community', detail: 'Commons, PeerProgramming' },
];

function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// A VAPID public key is base64url; pushManager.subscribe needs it as bytes (a plain ArrayBuffer so it
// satisfies BufferSource). Mirrors the Foundation call-alerts helper.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

// Ensure this device has a Web Push subscription so opted-in categories can ping it. Best-effort:
// returns a short note when it can't (unsupported browser, permission denied, push not configured on
// the server). The in-app feed works regardless; this only governs the device ping. Reuses the
// user-global push subscription (shared with Foundation), so a device subscribed once needs no repeat.
async function ensureDeviceSubscribed(): Promise<string | null> {
  if (!pushSupported()) {
    return 'This browser can’t show device alerts — the list above still updates in the app.';
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const existing = registration ? await registration.pushManager.getSubscription() : null;
    if (existing) {
      return null; // already subscribed on this device
    }
    if (Notification.permission === 'denied') {
      return 'Device alerts are blocked in your browser settings — the list above still updates in the app.';
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return 'Device alerts are off for now — the list above still updates in the app.';
    }
    const keyRes = await fetch('/api/notifications/push/vapid-public-key', { cache: 'no-store' });
    const keyData = (await keyRes.json().catch(() => ({}))) as { ok?: boolean; publicKey?: string };
    if (!keyRes.ok || !keyData.publicKey) {
      return 'Device alerts aren’t available yet — the list above still updates in the app.';
    }
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });
    const json = subscription.toJSON();
    await fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
    });
    return null;
  } catch {
    return 'Couldn’t turn on device alerts on this device — the list above still updates in the app.';
  }
}

// The notifications center: the member's own feed of updates across plugins, plus the device-push
// opt-ins. The in-app feed is always shown; the opt-ins only control the device ping and default off.
// Opt-in lives here (not buried in account settings) so it sits with the feed it governs.
// onOpenDeepLink lets the parent Commons shell intercept an in-app "Open" tap for a Commons deep link
// (/?post= or /?announcement=): the shell leaves this panel and scrolls to the message in place, since
// a client-side navigation to the same route would not remount the shell. It returns true when it
// handled the link (this component then blocks the Link's own navigation), false for a link that
// should navigate normally (e.g. /apps/<plugin>).
// The loading / error / empty note that sits above the feed. Returns null once real rows exist.
function NotificationsFeedStatus({
  loading,
  error,
  count,
}: {
  loading: boolean;
  error: string | null;
  count: number;
}) {
  if (loading && count === 0) {
    return <p className={styles.notificationsNote}>Loading…</p>;
  }
  if (!loading && error && count === 0) {
    return <p className={styles.notificationsNote} role="status">{error}</p>;
  }
  if (!loading && !error && count === 0) {
    return (
      <div className={styles.notificationsEmpty}>
        <p className={styles.notificationsEmptyTitle}>You&apos;re all caught up</p>
        <p className={styles.notificationsEmptyBody}>
          Updates you can act on — replies, credits, rides, and calls — show here as they happen.
        </p>
      </div>
    );
  }
  return null;
}

// A single notification row: dot, summary, time, and an optional in-app "Open" deep link.
function NotificationRow({
  item,
  markRead,
  onOpenDeepLink,
}: {
  item: Notification;
  markRead: (id: string) => void;
  onOpenDeepLink?: (linkPath: string) => boolean;
}) {
  return (
    <div
      className={item.isRead ? styles.notificationRow : `${styles.notificationRow} ${styles.notificationRowUnread}`}
      onMouseEnter={() => (item.isRead ? undefined : markRead(item.id))}
    >
      <span className={item.isRead ? styles.notificationDotRead : styles.notificationDot} aria-hidden="true" />
      <div className={styles.notificationBody}>
        <p className={styles.notificationSummary}>{item.summary}</p>
        <span className={styles.notificationTime}>{formatTime(item.createdAtIso)}</span>
        {item.linkPath ? (
          <Link
            href={item.linkPath}
            className={styles.announcementChip}
            onClick={(event) => {
              markRead(item.id);
              // Let the shell handle an in-Commons deep link in place (it can't rely on a remount);
              // if it did, block the Link's own navigation. A plugin link falls through and navigates.
              if (item.linkPath && onOpenDeepLink?.(item.linkPath)) {
                event.preventDefault();
              }
            }}
          >
            <ArrowUpRight size={13} color="currentColor" /> Open
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// Device-push opt-ins — the in-app feed is always on; these control the lock-screen ping only, and
// all default off. Placed with the feed (not in account settings) so a member manages what pings them
// right where they see what pinged them. Returns null until preferences have loaded.
function NotificationsManage({
  prefs,
  savingPref,
  pushNote,
  manageOpen,
  setManageOpen,
  togglePref,
}: {
  prefs: NotificationPreferences | null;
  savingPref: string | null;
  pushNote: string | null;
  manageOpen: boolean;
  setManageOpen: Dispatch<SetStateAction<boolean>>;
  togglePref: (key: keyof NotificationPreferences) => void;
}) {
  if (!prefs) return null;
  return (
    <div className={styles.notificationsManage}>
      <button
        type="button"
        className={styles.notificationsManageToggle}
        onClick={() => setManageOpen((open) => !open)}
        aria-expanded={manageOpen}
      >
        {manageOpen ? 'Hide' : 'Manage what pings your device'}
      </button>
      {manageOpen ? (
        <div className={styles.notificationsManageBody}>
          <p className={styles.notificationsManageNote}>
            Everything shows in this list either way. These switches only control whether your
            device also pings you. All are off unless you turn them on.
          </p>
          {pushNote ? (
            <p className={styles.notificationsManageNote} role="status">{pushNote}</p>
          ) : null}
          {PUSH_TOGGLES.map((toggle) => (
            <label key={toggle.key} className={styles.notificationsPrefRow} aria-label={toggle.label}>
              <input
                type="checkbox"
                aria-label={toggle.label}
                checked={prefs[toggle.key]}
                disabled={savingPref === toggle.key}
                onChange={() => togglePref(toggle.key)}
              />
              <span className={styles.notificationsPrefText}>
                <span className={styles.notificationsPrefLabel}>{toggle.label}</span>
                <span className={styles.notificationsPrefDetail}>{toggle.detail}</span>
              </span>
            </label>
          ))}
          <label className={styles.notificationsPrefRow} aria-label="Keep device pings discreet">
            <input
              type="checkbox"
              aria-label="Keep device pings discreet"
              checked={prefs.discreetPush}
              disabled={savingPref === 'discreetPush'}
              onChange={() => togglePref('discreetPush')}
            />
            <span className={styles.notificationsPrefText}>
              <span className={styles.notificationsPrefLabel}>Keep device pings discreet</span>
              <span className={styles.notificationsPrefDetail}>
                The ping just says you have an update — no plugin name or details on your lock screen.
              </span>
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function NotificationsPanel({ onOpenDeepLink }: { onOpenDeepLink?: (linkPath: string) => boolean }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [savingPref, setSavingPref] = useState<string | null>(null);
  // A short note shown when turning on a push category couldn't subscribe this device (unsupported
  // browser, blocked permission, or push not configured). The opt-in is still saved either way.
  const [pushNote, setPushNote] = useState<string | null>(null);

  // True only while this panel is on screen. Clearing the interval stops new polls, but a poll already
  // in flight when the member closes the panel still resolves afterwards, and its result belongs to a
  // panel that no longer exists. Same canceled-flag pattern the rest of the Commons shell uses.
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const payload = await requestJson<NotificationsResponse>('/api/notifications?limit=50');
      if (!mountedRef.current) return;
      setItems(payload.notifications);
      setError(null);
    } catch (loadError) {
      if (!mountedRef.current) return;
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    // Poll while the panel is open so a device ping that lands here shows without a manual refresh.
    const timer = setInterval(() => void load(), 20_000);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    void requestJson<NotificationPreferencesResponse>('/api/notifications/preferences')
      .then((payload) => setPrefs(payload.preferences))
      .catch(() => {
        /* preferences are best-effort; the panel still shows the feed */
      });
  }, []);

  const markRead = useCallback((id: string) => {
    // Optimistic: mark locally, then persist. A failure is swallowed (the poll reconciles).
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    void fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
      headers: { 'x-ctf-csrf': '1' },
    }).catch(() => undefined);
  }, []);

  const markAllRead = useCallback(() => {
    setItems((previous) => previous.map((item) => ({ ...item, isRead: true })));
    void fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: { 'x-ctf-csrf': '1' },
    }).catch(() => undefined);
  }, []);

  const togglePref = useCallback(
    (key: keyof NotificationPreferences) => {
      if (!prefs) return;
      const next = { ...prefs, [key]: !prefs[key] };
      setPrefs(next);
      setSavingPref(key);
      setPushNote(null);
      // Turning ON any of the three push categories needs a device subscription for the ping to land;
      // make sure this device is subscribed (best-effort — the opt-in still saves either way).
      const turningOnPush =
        (key === 'pushSafety' || key === 'pushActivity' || key === 'pushCommunity') && next[key] === true;
      if (turningOnPush) {
        void ensureDeviceSubscribed().then((note) => setPushNote(note));
      }
      void requestJson<NotificationPreferencesResponse>('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ [key]: next[key] }),
      })
        .then((payload) => setPrefs(payload.preferences))
        .catch(() => setPrefs(prefs))
        .finally(() => setSavingPref(null));
    },
    [prefs],
  );

  const hasUnread = items.some((item) => !item.isRead);

  return (
    <div className={styles.notificationsPanel}>
      <div className={styles.notificationsHeader}>
        <span className={styles.notificationsHeaderTitle}>Notifications</span>
        {hasUnread ? (
          <button type="button" className={styles.notificationsMarkAll} onClick={markAllRead}>
            <Check size={13} /> Mark all read
          </button>
        ) : null}
      </div>

      <NotificationsFeedStatus loading={loading} error={error} count={items.length} />

      {items.map((item) => (
        <NotificationRow key={item.id} item={item} markRead={markRead} onOpenDeepLink={onOpenDeepLink} />
      ))}

      <NotificationsManage
        prefs={prefs}
        savingPref={savingPref}
        pushNote={pushNote}
        manageOpen={manageOpen}
        setManageOpen={setManageOpen}
        togglePref={togglePref}
      />
    </div>
  );
}
