'use client';

import { failureText, responseFailureText } from 'lib/errors/client-failure';

// This browser's Web Push subscription, shared by the 3.0 notifications panel and 3.1 Settings:
// turning a notification row on makes sure this device can be pinged.

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

// True when this device's subscription was made with the server's current public key. One made with an
// older key can never be delivered to, so it is replaced rather than reused.
function sameServerKey(subscription: PushSubscription, key: Uint8Array): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  if (bytes.length !== key.length) return false;
  return bytes.every((value, index) => value === key[index]);
}

// Send this device's subscription to the server. The save upserts on (user, endpoint), so sending a
// subscription the server already holds is harmless, and sending it every time repairs a server copy
// that went missing (pruned after a failed send, or an earlier save that failed). Returns null when the
// server saved it, or the route's own reason when it did not (CSRF denial, bad payload, a failed save),
// so the member is never told device alerts are on when nothing was stored.
async function saveDeviceSubscription(subscription: PushSubscription): Promise<string | null> {
  const json = subscription.toJSON();
  const response = await fetch('/api/notifications/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    }),
  });
  if (response.ok) return null;
  return responseFailureText(
    response,
    'Couldn’t save device alerts for this device — the list below still updates in the app.',
    'member',
  );
}

// Ensure this device has a Web Push subscription the server knows about, so opted-in categories can
// ping it. Best-effort: returns a short note when it can't (unsupported browser, permission denied,
// push not configured on the server, the save failed). The in-app feed works regardless; this only
// governs the device ping. Reuses the user-global push subscription (shared with Foundation).
//
// `fromTap` is true when a member just switched a category on. Only then may it ask for permission,
// and it asks before anything else is awaited: iOS ignores a permission request that no longer counts
// as coming from the tap. Without a tap (the panel opening) it never prompts; it only re-sends an
// existing subscription and stays quiet about a browser that can't take one.
export async function ensureDeviceSubscribed(fromTap: boolean): Promise<string | null> {
  if (!pushSupported()) {
    return fromTap ? 'This browser can’t show device alerts — the list below still updates in the app.' : null;
  }
  try {
    const permission = await ensurePermission(fromTap);
    if (permission !== 'granted') return permission;
    const serverKey = await fetchServerKey();
    if (!serverKey) {
      return 'Device alerts aren’t available yet — the list below still updates in the app.';
    }
    const subscription = await currentSubscription(serverKey);
    return await saveDeviceSubscription(subscription);
  } catch (caught) {
    return failureText(caught, {
      area: 'notifications',
      op: fromTap ? 'device_subscribe' : 'device_resync',
      fallback: 'Couldn’t turn on device alerts on this device — the list below still updates in the app.',
      audience: 'member',
    });
  }
}

// 'granted', or the note to show (null for a quiet no without a tap). Asks only from a tap, and as the
// first awaited step, so iOS still counts the request as coming from that tap.
async function ensurePermission(fromTap: boolean): Promise<'granted' | string | null> {
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') {
    return 'Device alerts are blocked in your browser settings — the list below still updates in the app.';
  }
  if (!fromTap) return null;
  const permission = await Notification.requestPermission();
  return permission === 'granted' ? 'granted' : 'Device alerts are off for now — the list below still updates in the app.';
}

// The server's public push key as bytes, or null when push is not configured on the server.
async function fetchServerKey(): Promise<Uint8Array<ArrayBuffer> | null> {
  const keyRes = await fetch('/api/notifications/push/vapid-public-key', { cache: 'no-store' });
  const keyData = (await keyRes.json().catch(() => ({}))) as { ok?: boolean; publicKey?: string };
  return keyRes.ok && keyData.publicKey ? urlBase64ToUint8Array(keyData.publicKey) : null;
}

// This device's subscription for the current server key: the existing one when it matches, otherwise
// a fresh one (an old-key subscription is dropped first).
async function currentSubscription(serverKey: Uint8Array<ArrayBuffer>): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing && sameServerKey(existing, serverKey)) return existing;
  if (existing) await existing.unsubscribe();
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
}
