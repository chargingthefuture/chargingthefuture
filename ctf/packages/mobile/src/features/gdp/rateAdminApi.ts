// GDP currency rate-admin API client for mobile (issue #312 P2).
// Mirrors GET/POST /api/gdp/admin/currency-rates. These factors exist ONLY to roll
// multi-currency volume into the single USD-denominated GDP estimate — never a
// per-wallet or redemption "ServiceCredits = fiat" value.

// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
import { authedFetch } from '../../auth/authedFetch';

const BASE = '/api/gdp/admin/currency-rates';

export type CurrencyRateFactor = { usdRate: number; asOf: string; source: string };

export type CurrencyRateEntry = {
  code: string;
  label: string;
  symbol: string | null;
  isServiceCredits: boolean;
  decimalPlaces: number;
  sortOrder: number;
  current: CurrencyRateFactor | null;
  history: CurrencyRateFactor[];
};

type ListResponse = {
  ok: boolean;
  currencies?: CurrencyRateEntry[];
  code?: string;
  message?: string;
};

type ReviseResponse = {
  ok: boolean;
  rate?: { currencyCode: string; usdRate: number; asOf: string; source: string };
  code?: string;
  message?: string;
};

export async function fetchCurrencyRates(): Promise<CurrencyRateEntry[]> {
  const res = await authedFetch(BASE);
  if (!res.ok) {
    throw new Error(`gdp_currency_rates_fetch_failed:${res.status}`);
  }
  const json: ListResponse = await res.json();
  if (json.ok && json.currencies) {
    return json.currencies;
  }
  throw new Error(json.message ?? 'Failed to load currency factors.');
}

export async function reviseCurrencyRate(input: {
  currencyCode: string;
  usdRate: number;
  source: string;
}): Promise<void> {
  const res = await authedFetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify(input),
  });
  const json: ReviseResponse = await res.json().catch(() => ({ ok: false }) as ReviseResponse);
  if (res.ok && json.ok) {
    return;
  }
  throw new Error(json.message ?? 'Failed to save the new factor.');
}

// United States Dollar is the baseline; its factor is fixed at 1 and not revised.
export function isFixedBaseline(entry: CurrencyRateEntry): boolean {
  return entry.code === 'USD';
}

export function formatFactor(entry: CurrencyRateEntry): string {
  if (isFixedBaseline(entry)) return '1 : 1';
  if (!entry.current) return 'Not set';
  const r = entry.current.usdRate;
  const d = r < 0.001 ? 5 : r < 0.1 ? 4 : 3;
  return `$${r.toFixed(d)}`;
}
