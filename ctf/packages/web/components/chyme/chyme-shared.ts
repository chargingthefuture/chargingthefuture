// Shared constants, types, and helpers for the Chyme web shell.
// Palette derives from design/.../survivor-hub/ChymeApp.tsx.

export const PRIMARY = '#22C55E';
export const DARK_BG = '#021006';
export const CARD_BG = '#041a0b';
export const BORDER = '#052e16';

export type CurrentUser = {
  userId: string;
  username: string | null;
  displayName: string;
};

type RequestError = {
  message: string;
};

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
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

export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
