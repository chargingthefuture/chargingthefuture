import { queryDb } from 'lib/db/postgres';

// Multi-currency GDP recognition (issue #121). This module is the GDP "estimation layer": the ONLY
// place the notional USD conversion factors from currency_usd_rates are applied. It rolls
// multi-currency transaction volume into the single, estimate-labeled GDP figure.
//
// LEGAL GUARDRAIL: these factors must never be surfaced as a per-wallet or per-price
// "ServiceCredits = fiat" equivalence. A user never sees "your N ServiceCredits = $X". The only place
// a USD-normalized ServiceCredits value appears is inside the aggregate, estimate-labeled GDP total.

/** A single-currency transaction volume to recognize into the USD GDP estimate. */
export interface CurrencyVolume {
  amount: number;
  currencyCode: string;
}

/** The result of rolling multi-currency volume into one USD estimate. */
export interface UsdEstimate {
  /** USD-denominated estimate (not an accounting figure; small drift is acceptable and disclosed). */
  usdEstimate: number;
  /** Currency codes that had no active rate and were therefore excluded (surfaced, never silently dropped). */
  unratedCurrencies: string[];
}

/**
 * The active USD conversion factor per currency: the most recent `as_of` row per `currency_code` in
 * `currency_usd_rates`. `1` unit of the currency is worth `usd_rate` USD (a notional estimate the owner
 * curates). Returns a map keyed by currency code.
 */
export async function getActiveUsdRates(): Promise<Map<string, number>> {
  const result = await queryDb<{ currency_code: string; usd_rate: string }>(
    `SELECT DISTINCT ON (currency_code) currency_code, usd_rate::text AS usd_rate
       FROM currency_usd_rates
       ORDER BY currency_code, as_of DESC`,
  );
  const rates = new Map<string, number>();
  for (const row of result.rows) {
    rates.set(row.currency_code, Number(row.usd_rate));
  }
  return rates;
}

/**
 * Roll a set of multi-currency volumes into one USD-denominated estimate using the active rates.
 * A currency with no active rate is excluded and reported in `unratedCurrencies` rather than being
 * treated as zero-value without surfacing it. The output is an ESTIMATE, labeled as such in-product.
 */
export function normalizeVolumesToUsd(
  volumes: CurrencyVolume[],
  rates: Map<string, number>,
): UsdEstimate {
  let usdEstimate = 0;
  const unrated = new Set<string>();
  for (const volume of volumes) {
    const rate = rates.get(volume.currencyCode);
    if (rate === undefined) {
      unrated.add(volume.currencyCode);
      continue;
    }
    usdEstimate += volume.amount * rate;
  }
  return { usdEstimate, unratedCurrencies: [...unrated] };
}

/** Convenience: load the active rates and normalize in one call (server-side only). */
export async function recognizeUsdEstimate(volumes: CurrencyVolume[]): Promise<UsdEstimate> {
  const rates = await getActiveUsdRates();
  return normalizeVolumesToUsd(volumes, rates);
}
