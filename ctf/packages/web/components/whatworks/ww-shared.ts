// Design tokens taken verbatim from design/.../survivor-hub/WhatWorks.tsx (no token system in
// the mockups — hex values are matched directly per the design-mockup implementation rules).
export const BRAND = '#84CC16';
export const BG = '#0F1117';
export const SURFACE = '#161B27';
export const BORDER = '#1E2A3A';
export const TEXT = '#F9FAFB';
export const SUBTLE = '#6B7280';
export const FAINT = '#4B5563';

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

// Honest retailer label: the mockup says "View on Amazon", but purchase links are arbitrary,
// so only say Amazon when the link actually is. Everything else reads "View product".
export function purchaseLinkLabel(url: string): string {
  try {
    if (new URL(url).hostname.toLowerCase().includes('amazon')) {
      return 'View on Amazon';
    }
  } catch {
    return 'View product';
  }
  return 'View product';
}
