// Design tokens taken verbatim from design/.../survivor-hub/WhatWorks.tsx (no token system in
// the mockups — hex values are matched directly per the design-mockup implementation rules).
import { getAppAccent, type ThemeName } from '@/lib/theme/theme-tokens';
import { getPluginShellTokens, type PluginShellTokens } from '@/components/shared/plugin-shell-theme';

export const BRAND = '#84CC16';
export const BG = '#0F1117';
export const SURFACE = '#161B27';
export const BORDER = '#1E2A3A';
export const TEXT = '#F9FAFB';
export const SUBTLE = '#6B7280';
export const FAINT = '#4B5563';

// Theme-aware chrome tokens for the WhatWorks shell. Default keeps the shipped values (accent stays
// #84CC16); comic uses the shared comic surface tokens plus the WhatWorks comic-ink accent. The shell
// paints a solid #1E2A3A chrome border that is distinct from the shared white-alpha border, so it is
// carried as its own BORDER_SOLID token (default #1E2A3A, comic comic-border-faint).
export type WhatWorksTokens = PluginShellTokens & { BORDER_SOLID: string };

export function getWhatWorksTokens(theme: ThemeName): WhatWorksTokens {
  if (theme === 'comic') {
    const accent = getAppAccent('what-works', 'comic');
    return { ...getPluginShellTokens(accent, theme), BORDER_SOLID: '#D4C49A1A' };
  }
  return { ...getPluginShellTokens(BRAND, theme), BORDER_SOLID: '#1E2A3A' };
}

// List sizing (owner directive, 2026-08-24: lists are paged, never scrolled without end).
// A problem shows its first two tools; the rest are behind an expand control, so one problem can
// never stretch the page on its own. Problems and admin rows are paged a screenful at a time.
export const TOOLS_SHOWN_COLLAPSED = 2;
export const PROBLEMS_PER_PAGE = 5;
export const ADMIN_PROBLEMS_PER_PAGE = 5;
export const ADMIN_PRODUCTS_PER_PAGE = 5;

// Page index that is always in range for the current list length: the list can shrink under the
// reader (a search narrows it, an admin deletes a row) while the page index stays where it was.
export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(page, 0), Math.max(pageCount - 1, 0));
}

// How many pages a list of this length needs. Always at least 1, so "Page 1 of 1" holds for an
// empty list.
export function pageCountFor(itemCount: number, perPage: number): number {
  return Math.max(1, Math.ceil(itemCount / perPage));
}

// The external long-form explainer the right-rail footnote points at (owner-confirmed).
export const LOOK_MA_URL = 'https://www.chargingthefuture.com/look-ma';

export type WhatWorksProduct = {
  id: string;
  emoji: string;
  name: string;
  kind: string;
  note: string;
  purchaseUrl: string;
  verifiedCount: number;
  viewerHasEndorsed: boolean;
};

export type WhatWorksProblem = {
  id: string;
  slug: string;
  emoji: string;
  title: string;
  context: string;
  products: WhatWorksProduct[];
};

export type WhatWorksStats = {
  problems: number;
  verifiedTools: number;
  survivorsHelped: number;
};

export type WhatWorksListResponse = {
  ok: boolean;
  problems: WhatWorksProblem[];
  stats: WhatWorksStats;
  viewer?: { isAdmin: boolean };
};

export type WhatWorksProblemOption = {
  id: string;
  slug: string;
  emoji: string;
  title: string;
  context: string;
};

export type SuggestDraft = {
  problemId: string;
  name: string;
  purchaseUrl: string;
  note: string;
};

export const EMPTY_SUGGEST_DRAFT: SuggestDraft = {
  problemId: '',
  name: '',
  purchaseUrl: '',
  note: '',
};
