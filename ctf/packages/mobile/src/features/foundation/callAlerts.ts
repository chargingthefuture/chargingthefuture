// Call alerts on this device: the native push that rings the phone for a Foundation instant call when
// the app is closed.
//
// The server sends an Expo push for each ring (dispatchRingDelivery → sendExpoPushToUser in web
// lib/notifications/expo-push.ts) to every `kind: 'expo'` row in push_subscriptions, on the Android
// channel `foundation-calls`. This module creates that channel, asks for notification permission
// (Android 13 and later ask at runtime), reads the device's Expo push token and saves it through
// POST /api/foundation/push/subscribe with `{ kind: 'expo', token }`. Turning alerts off removes the
// row through POST /api/foundation/push/unsubscribe with `{ endpoint: token }`.
//
// Whether alerts are on is remembered in expo-secure-store, which the app already uses for the sign-in
// session and the theme; the server row is the real record, this only drives the toggle.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { subscribeExpoPush, unsubscribeExpoPush } from './FoundationApi';
import { registerSignOutTask } from '../../auth/signOutTasks';

// Must match `channelId` in web lib/notifications/expo-push.ts.
export const FOUNDATION_CALL_CHANNEL_ID = 'foundation-calls';

// Must match `data.type` in web lib/foundation/ring-push.ts.
export const RING_PUSH_TYPE = 'foundation.instant_call.ring';

const STORE_KEY = 'ctf.foundation.callAlerts.v1';

type Stored = { token: string };

export async function loadAlertToken(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return typeof parsed.token === 'string' && parsed.token.length > 0 ? parsed.token : null;
  } catch {
    // no-trace: an unreadable stored value reads as "alerts off"; the toggle can turn them on again
    return null;
  }
}

async function saveAlertToken(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify({ token } satisfies Stored));
  } else {
    await SecureStore.deleteItemAsync(STORE_KEY);
  }
}

// The ring channel: high importance so Android shows it as a heads-up alert, with the default sound.
// Safe to call more than once; Android keeps the first settings the member has not changed.
export async function ensureRingChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(FOUNDATION_CALL_CHANNEL_ID, {
    name: 'Foundation calls',
    description: 'Rings for incoming Foundation calls',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 300, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

function easProjectId(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as { eas?: { projectId?: string } };
  const id = extra.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

async function askPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export type EnableResult = { ok: true; token: string } | { ok: false; error: string };

export async function enableCallAlerts(): Promise<EnableResult> {
  await ensureRingChannel();
  if (!(await askPermission())) {
    return {
      ok: false,
      error: 'Notifications are blocked for this app. Allow them in Android settings to turn on call alerts. You still see an incoming call while the app is open.',
    };
  }
  const projectId = easProjectId();
  if (!projectId) {
    return { ok: false, error: 'This build of the app has no project id, so it cannot get a push token. Call alerts need a store or EAS build.' };
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await subscribeExpoPush(token);
  await saveAlertToken(token);
  return { ok: true, token };
}

export async function disableCallAlerts(token: string): Promise<void> {
  await unsubscribeExpoPush(token);
  await saveAlertToken(null);
}

// The call id carried by a ring push, or null when the notification is something else.
export function ringCallIdOf(notification: Notifications.Notification): string | null {
  const data = notification.request.content.data as { type?: unknown; callId?: unknown } | null;
  if (!data || data.type !== RING_PUSH_TYPE) return null;
  return typeof data.callId === 'string' && data.callId.length > 0 ? data.callId : null;
}

// Signing out removes this phone's call alerts from the account, so the phone stops ringing for a member
// who is no longer signed in on it. The next member turns alerts on for themselves.
registerSignOutTask('foundation-call-alerts', async () => {
  const token = await loadAlertToken();
  if (!token) return;
  try {
    await disableCallAlerts(token);
  } finally {
    // Even when the server could not be reached, the next member on this phone starts with alerts off.
    await saveAlertToken(null);
  }
});
