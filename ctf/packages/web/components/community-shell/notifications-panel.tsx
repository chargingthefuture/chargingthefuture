'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
  { key: 'pushActivity', label: 'Your activity and credits', detail: 'ServiceCredits, LevelUp, Recurring Activity' },
  { key: 'pushCommunity', label: 'Community', detail: 'Commons, PeerProgramming' },
];

// The notifications center: the member's own feed of updates across plugins, plus the device-push
// opt-ins. The in-app feed is always shown; the opt-ins only control the device ping and default off.
// Opt-in lives here (not buried in account settings) so it sits with the feed it governs.
export function NotificationsPanel() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [savingPref, setSavingPref] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const payload = await requestJson<NotificationsResponse>('/api/notifications?limit=50');
      setItems(payload.notifications);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Poll while the panel is open so a device ping that lands here shows without a manual refresh.
    const timer = setInterval(() => void load(), 20_000);
    return () => clearInterval(timer);
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

      {loading && items.length === 0 ? (
        <p className={styles.notificationsNote}>Loading…</p>
      ) : null}

      {!loading && error && items.length === 0 ? (
        <p className={styles.notificationsNote} role="status">{error}</p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className={styles.notificationsEmpty}>
          <p className={styles.notificationsEmptyTitle}>You&apos;re all caught up</p>
          <p className={styles.notificationsEmptyBody}>
            Updates you can act on — replies, credits, rides, and calls — show here as they happen.
          </p>
        </div>
      ) : null}

      {items.map((item) => (
        <div
          key={item.id}
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
                onClick={() => markRead(item.id)}
              >
                <ArrowUpRight size={13} color="currentColor" /> Open
              </Link>
            ) : null}
          </div>
        </div>
      ))}

      {/* Device-push opt-ins — the in-app feed above is always on; these control the lock-screen ping
          only, and all default off. Placed here (not in account settings) so a member manages what
          pings them right where they see what pinged them. */}
      {prefs ? (
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
      ) : null}
    </div>
  );
}
