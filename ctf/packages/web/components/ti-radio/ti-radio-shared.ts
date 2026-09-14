// Shared helpers for the TI Radio guide: theme tokens, a same-origin fetch with the CSRF header,
// timezone detection, and the date/time formatting the guide prints. Browser-safe utilities only.

import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export function getTiRadioTokens(theme: ThemeName): PluginShellTokens {
  return getPluginShellTokens(getAppAccent('ti-radio', theme), theme);
}

type RequestError = { message: string };

// Reads carry nothing extra; a mutation carries the CSRF confirmation header the server checks, and
// a JSON content type when there is a body. Its own function so requestJson stays simple.
function buildHeaders(init: RequestInit | undefined): Headers {
  const headers = new Headers(init?.headers);
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return headers;
  }
  headers.set('x-ctf-csrf', '1');
  if (init?.body) {
    headers.set('content-type', 'application/json');
  }
  return headers;
}

// The message the server sent, or a plain fallback. A thrown Error with the route's own sentence in
// it is what every screen here shows the reader, so losing it would leave them with "Request failed".
function errorMessage(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as RequestError).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return 'Request failed.';
}

/** Same-origin JSON fetch, with the `x-ctf-csrf` confirmation header on mutations. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init, headers: buildHeaders(init) });
  const payload = (await response.json().catch(() => null)) as T | RequestError | null;
  if (!response.ok) {
    throw new Error(errorMessage(payload));
  }
  return payload as T;
}

// --- Time ---------------------------------------------------------------------------------------
//
// Everything on the guide is stored and compared in UTC and printed in the reader's own timezone.
// A schedule people from twenty countries read has to say "9pm where you are", not "9pm somewhere".

export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function timeZoneLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
    const abbr = parts.find((part) => part.type === 'timeZoneName')?.value;
    const pretty = tz.replace(/_/g, ' ');
    return abbr ? `${pretty} (${abbr})` : pretty;
  } catch {
    return tz.replace(/_/g, ' ');
  }
}

export function formatTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
}

/** "7:30 PM – 9:00 PM", the whole 90 minutes as one label. */
export function formatRange(startIso: string, endIso: string, tz: string): string {
  return `${formatTime(startIso, tz)} – ${formatTime(endIso, tz)}`;
}

/** "Mon, Sep 14" in the reader's timezone. */
export function formatDayLabel(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
}

/** A stable YYYY-MM-DD key for the slot's local date, used to group slots into days. */
export function localDateKey(iso: string, tz: string): string {
  // en-CA renders as YYYY-MM-DD.
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });
}

/** Group the guide's slots into consecutive local days, in order. */
export function groupByLocalDay<T extends { slotStartIso: string }>(
  slots: T[],
  tz: string,
): { key: string; label: string; slots: T[] }[] {
  const days: { key: string; label: string; slots: T[] }[] = [];
  for (const slot of slots) {
    const key = localDateKey(slot.slotStartIso, tz);
    const last = days[days.length - 1];
    if (last && last.key === key) {
      last.slots.push(slot);
    } else {
      days.push({ key, label: formatDayLabel(slot.slotStartIso, tz), slots: [slot] });
    }
  }
  return days;
}
