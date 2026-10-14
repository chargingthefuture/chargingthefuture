// The account area's own colors, copied from the web's getAccountDataTokens
// (components/account-data/account-data-shared.ts). The web's Your account, Account & Data and
// Blocked members screens all read this palette rather than the shell tokens, so the Android
// screens do too.

import type { ThemeTokens } from '../../theme';

export type AccountTokens = {
  BRAND: string;
  BG: string;
  SURFACE: string;
  BORDER: string;
  TEXT: string;
  SUBTLE: string;
};

export const DEFAULT_ACCOUNT_TOKENS: AccountTokens = {
  BRAND: '#D946EF',
  BG: '#0F1117',
  SURFACE: '#161B27',
  BORDER: '#1E2A3A',
  TEXT: '#D5D9E2',
  SUBTLE: '#6B7280',
};

const COMIC_ACCOUNT_TOKENS: AccountTokens = {
  BRAND: '#B91C1C',
  BG: '#0D0D0D',
  SURFACE: '#141414',
  BORDER: '#D4C49A',
  TEXT: '#EDE3CB',
  SUBTLE: '#7A6A50',
};

export function getAccountTokens(t: ThemeTokens): AccountTokens {
  return t.isComic ? COMIC_ACCOUNT_TOKENS : DEFAULT_ACCOUNT_TOKENS;
}

// The web comic theme squares every corner (globals.css sets border-radius: 0 on everything), so a
// radius the web writes inline becomes 0 under comic.
export function radius(t: ThemeTokens, value: number): number {
  return t.isComic ? 0 : value;
}
