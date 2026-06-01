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

/**
 * A named source of recognizable economic volume — one per contributing plugin. GDP recognition spans
 * all applicable plugins; sources register below and the aggregator rolls them up. TrustTransport is
 * the first source; add others (e.g. LightHouse paid rent, LevelUp disbursements) here as the owner
 * approves them. A source must contribute ONLY eligible settled spend — never transfers or
 * deletion/reclaim reallocations, which the GDP non-recognition rules exclude.
 */
export interface RecognitionSource {
  pluginSlug: string;
  label: string;
  /** Load this source's eligible settled spend, one entry per currency (server-side). */
  loadVolumes(): Promise<CurrencyVolume[]>;
}

/**
 * TrustTransport: the value of completed marketplace tasks credited to providers. Recognizes the
 * positive earning entries (`credit` + `release`); excludes `debit`/`hold` (internal/pending) and any
 * reclaim/reallocation. Groups by the referenced `price_currency`, falling back to the legacy
 * free-text `currency`; unknown codes are surfaced (not silently dropped) by the normalizer.
 */
export const trustTransportSource: RecognitionSource = {
  pluginSlug: 'trusttransport',
  label: 'TrustTransport completed-task earnings',
  async loadVolumes() {
    const result = await queryDb<{ currency_code: string | null; total: string }>(
      `SELECT COALESCE(price_currency, currency) AS currency_code, SUM(amount)::text AS total
         FROM trusttransport_earnings_ledger
         WHERE entry_type IN ('credit', 'release')
         GROUP BY COALESCE(price_currency, currency)`,
    );
    return result.rows
      .filter((row): row is { currency_code: string; total: string } => Boolean(row.currency_code))
      .map((row) => ({ amount: Number(row.total), currencyCode: row.currency_code }));
  },
};

/**
 * Registered GDP recognition sources. Start with TrustTransport; append other plugins' eligible-spend
 * sources here (and document them in the GDP inventory) as the owner approves each one.
 */
export const RECOGNITION_SOURCES: RecognitionSource[] = [trustTransportSource];

/** A USD estimate plus the per-source breakdown that composes it. */
export interface RecognitionBreakdown extends UsdEstimate {
  perSource: Array<{ pluginSlug: string; usdEstimate: number }>;
}

/**
 * Roll recognized volume across every registered source into one USD estimate, applying the active
 * `currency_usd_rates` factors once. This multi-plugin aggregate AUGMENTS the projection-based GDP
 * target (it does not replace it) and is always labeled an estimate.
 */
export async function recognizeGdpVolumeUsd(): Promise<RecognitionBreakdown> {
  const rates = await getActiveUsdRates();
  let usdEstimate = 0;
  const unrated = new Set<string>();
  const perSource: Array<{ pluginSlug: string; usdEstimate: number }> = [];
  for (const source of RECOGNITION_SOURCES) {
    const volumes = await source.loadVolumes();
    const result = normalizeVolumesToUsd(volumes, rates);
    usdEstimate += result.usdEstimate;
    result.unratedCurrencies.forEach((code) => unrated.add(code));
    perSource.push({ pluginSlug: source.pluginSlug, usdEstimate: result.usdEstimate });
  }
  return { usdEstimate, unratedCurrencies: [...unrated], perSource };
}
