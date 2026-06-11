// Fetches the active currency catalog for the shared payment selector (issue #420). Mirrors
// GET /api/currencies (web app/api/currencies/route.ts). ServiceCredits sorts first; barter is
// included when present in the catalog.
import { authedFetchJson } from '../../auth/authedFetch';
import type { Currency } from './types';

export async function fetchCurrencies(): Promise<Currency[]> {
  const data = await authedFetchJson<{ ok: boolean; currencies?: Currency[] }>('/api/currencies');
  return Array.isArray(data.currencies) ? data.currencies : [];
}
