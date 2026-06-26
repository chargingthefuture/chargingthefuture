import type { WhatWorksProductStatus } from './types';

export const WHAT_WORKS_PRODUCT_STATUSES: readonly WhatWorksProductStatus[] = [
  'pending',
  'approved',
  'rejected',
];

export const MAX_PRODUCT_NAME_LENGTH = 120;
export const MAX_PRODUCT_KIND_LENGTH = 120;
export const MAX_PRODUCT_NOTE_LENGTH = 400;
export const MAX_PURCHASE_URL_LENGTH = 2048;
export const MAX_PROBLEM_TITLE_LENGTH = 120;
export const MAX_PROBLEM_CONTEXT_LENGTH = 280;
export const MAX_EMOJI_LENGTH = 16;

// Public visitors see a teaser slice of the list; the full list is sign-in gated.
export const PUBLIC_PREVIEW_PROBLEM_LIMIT = 2;
export const PUBLIC_PREVIEW_PRODUCTS_PER_PROBLEM = 2;

export function isWhatWorksProductStatus(value: unknown): value is WhatWorksProductStatus {
  return typeof value === 'string' && WHAT_WORKS_PRODUCT_STATUSES.includes(value as WhatWorksProductStatus);
}
