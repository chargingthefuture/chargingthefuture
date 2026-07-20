// Shared helpers for the Mutual Time web shells: theme tokens (rose accent from the design), a
// same-origin fetch helper with the CSRF header, timezone detection/formatting, candidate-slot
// grouping, and the share-link copy helper (rule 130). Pure/browser-safe utilities only.

import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { MUTUAL_TIME_MEETING_MINUTES } from 'lib/mutual-time/constants';

export function getMutualTimeTokens(theme: ThemeName): PluginShellTokens {
  return getPluginShellTokens(getAppAccent('mutual-time', theme), theme);
}

type RequestError = { message: string };

// Same-origin fetch with JSON + the `x-ctf-csrf` confirmation header on mutations (matches the server
// `ensureMutationCsrf` guard). Reads (GET/HEAD) skip it.
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers);
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('x-ctf-csrf', '1');
  }
  const response = await fetch(url, { cache: 'no-store', ...init, headers });
  const payload = (await response.json().catch(() => null)) as T | RequestError | null;
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload ? payload.message : 'Request failed.';
    throw new Error(message);
  }
  return payload as T;
}

// The one shareable link for an event.
export function eventShareUrl(slug: string): string {
  if (typeof window === 'undefined') {
    return `/mutual-time/${slug}`;
  }
  return `${window.location.origin}/mutual-time/${slug}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to false */
  }
  return false;
}

// --- Timezone helpers ---------------------------------------------------------------------------

export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Every IANA zone the runtime knows (modern browsers), else a small curated fallback. Used to populate
// the "change timezone" picker, so a member on a VPN can correct it.
export function listTimeZones(): string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (typeof supported === 'function') {
      const zones = supported('timeZone');
      if (Array.isArray(zones) && zones.length > 0) {
        return zones;
      }
    }
  } catch {
    /* fall through */
  }
  return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];
}

// A short label for the current zone + its abbreviation, e.g. "America/New York (EDT)".
export function timeZoneLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
    const abbr = parts.find((p) => p.type === 'timeZoneName')?.value;
    const pretty = tz.replace(/_/g, ' ');
    return abbr ? `${pretty} (${abbr})` : pretty;
  } catch {
    return tz.replace(/_/g, ' ');
  }
}

export function formatSlotTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
}

// "3:00 PM – 4:00 PM" for the one-hour window.
export function formatSlotRange(iso: string, tz: string): string {
  const end = new Date(new Date(iso).getTime() + MUTUAL_TIME_MEETING_MINUTES * 60000).toISOString();
  return `${formatSlotTime(iso, tz)} – ${formatSlotTime(end, tz)}`;
}

// "Mon, Jul 21" in the viewer's timezone.
export function formatSlotDate(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
}

// Full result string, e.g. "Tuesday, July 22 at 3:00 PM".
export function formatResultDateTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// A stable YYYY-MM-DD key for the slot's LOCAL date in the viewer's timezone (for date chips/grouping).
export function localDateKey(iso: string, tz: string): string {
  // en-CA renders as YYYY-MM-DD.
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });
}

export type SlotPeriod = { key: 'night' | 'morning' | 'afternoon' | 'evening'; label: string; order: number };

// Group a slot into a local period by its hour in the viewer's timezone.
export function localPeriod(iso: string, tz: string): SlotPeriod {
  let hour = 12;
  try {
    const hourStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).formatToParts(new Date(iso)).find((p) => p.type === 'hour')?.value;
    if (hourStr) {
      hour = Number.parseInt(hourStr, 10) % 24;
    }
  } catch {
    /* keep default */
  }
  if (hour < 5) return { key: 'night', label: 'Night', order: 0 };
  if (hour < 12) return { key: 'morning', label: 'Morning', order: 1 };
  if (hour < 17) return { key: 'afternoon', label: 'Afternoon', order: 2 };
  return { key: 'evening', label: 'Evening', order: 3 };
}
