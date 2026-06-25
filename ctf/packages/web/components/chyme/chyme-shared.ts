// Shared constants, types, and helpers for the Chyme web shell.
// Palette derives from design/.../survivor-hub/ChymeApp.tsx.

import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export const PRIMARY = '#22C55E';
export const DARK_BG = '#04160A';
export const CARD_BG = '#041a0b';
export const BORDER = '#052e16';
// The chrome panel/header/rail surface the shells paint (darker than DARK_BG).
export const PANEL_BG = '#030d05';
// Bright title tone the shells use for headings.
export const TITLE = '#F0FDF4';

// Chyme ships its own deep-green chrome surfaces — a near-black green page background
// (#04160A), a deepest-chrome panel/header/rail (#030d05), a green-ink divider (#052e16),
// and a mint-white title (#F0FDF4). Those values differ from the shared default surfaces, so
// the default branch overrides exactly those token slots and leaves the rest of the shared
// default values (text tones, white-alpha inactive borders, input surface) untouched — so the
// default theme renders byte-for-byte as today. The shell also paints its accent both as solid
// #22C55E and as rgba(34,197,94,…) tints; the default theme returns those exact strings so they
// render identically when the toggle is off, while comic maps each to the Chyme comic-ink accent
// at the matching alpha. Comic uses the shared comic surfaces plus that comic-ink accent.
export type ChymeTokens = PluginShellTokens & {
  ACCENT_TINT_10: string; // back-button background tint (default 0.1)
  ACCENT_TINT_15: string; // logo/avatar background tint (default 0.15)
  ACCENT_TINT_30: string; // back-button border tint (default 0.3)
  ACCENT_TINT_40: string; // logo/avatar border tint (default 0.4)
};

export function getChymeTokens(theme: ThemeName): ChymeTokens {
  if (theme === 'comic') {
    const accent = getAppAccent('chyme', 'comic');
    return {
      ...getPluginShellTokens(accent, theme),
      ACCENT_TINT_10: `${accent}1A`,
      ACCENT_TINT_15: `${accent}26`,
      ACCENT_TINT_30: `${accent}4D`,
      ACCENT_TINT_40: `${accent}66`,
    };
  }
  return {
    ...getPluginShellTokens(PRIMARY, theme),
    BG: DARK_BG,
    HEADER: PANEL_BG,
    RAIL: PANEL_BG,
    TITLE,
    BORDER,
    ACCENT_TINT_10: 'rgba(34,197,94,0.1)',
    ACCENT_TINT_15: 'rgba(34,197,94,0.15)',
    ACCENT_TINT_30: 'rgba(34,197,94,0.3)',
    ACCENT_TINT_40: 'rgba(34,197,94,0.4)',
  };
}

export type CurrentUser = {
  userId: string;
  username: string | null;
};

type RequestError = {
  message: string;
};

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  // Attach the same-origin CSRF confirmation header on state-changing requests, matching the
  // server-side `ensureMutationCsrf` guard on the chyme mutation routes. Reads (GET/HEAD) skip it.
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers);
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('x-ctf-csrf', '1');
  }
  const response = await fetch(url, { cache: 'no-store', ...init, headers });
  const payload = (await response.json().catch(() => null)) as T | RequestError | null;
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? payload.message
        : 'Request failed.';
    throw new Error(message);
  }
  return payload as T;
}

export function chymeHandle(username: string | null, userId: string): string {
  return username ? `@${username}` : `user-${userId.slice(0, 8)}`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
