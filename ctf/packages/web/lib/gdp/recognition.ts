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

// ServiceCredits is a non-redeemable utility token — it cannot be converted to fiat by anyone. So it is
// deliberately NEVER folded into the USD estimate. Its recognized service volume is reported separately
// in ServiceCredits units (a measure of community mutual-aid activity), shown alongside the USD GDP so
// neither figure alone understates the community's progress toward self-sufficiency. The conversion code
// below skips this currency entirely; there is no "SC = $X" anywhere.
export const SERVICE_CREDITS_CODE = 'SC';

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
    // ServiceCredits is never converted to USD (non-redeemable utility token); it is reported in its
    // own units by the aggregator, so it is neither converted here nor counted as "unrated".
    if (volume.currencyCode === SERVICE_CREDITS_CODE) {
      continue;
    }
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
 * LevelUp: ServiceCredits paid to a trainer for validated mentorship work. Each trainer payout is a
 * governed mint grant (`mintGrant` with reason `levelup_trainer_split`) recorded in
 * `service_credits_governance_events`; the amount is always in ServiceCredits (code `SC`). This is the
 * one eligible-spend slice of LevelUp — service delivered for validated work. Deliberately EXCLUDES
 * learner-side amounts (escrow returns, completion bonuses, stipends, microgrants), which are
 * incentives/returns, not spend. We read the governance-events record, not the SC ledger, because the
 * ledger marks these entries `accounting_scope = service_credits_non_gdp` by design.
 */
export const levelUpTrainerPayoutSource: RecognitionSource = {
  pluginSlug: 'levelup',
  label: 'LevelUp trainer payouts for validated work',
  async loadVolumes() {
    const result = await queryDb<{ total: string | null }>(
      `SELECT SUM(amount)::text AS total
         FROM service_credits_governance_events
         WHERE event_type = 'mint_grant' AND reason = 'levelup_trainer_split'`,
    );
    const total = Number(result.rows[0]?.total ?? 0);
    if (!Number.isFinite(total) || total <= 0) {
      return [];
    }
    return [{ amount: total, currencyCode: 'SC' }];
  },
};

/**
 * Registered GDP recognition sources. Start with TrustTransport; append other plugins' eligible-spend
 * sources here (and document them in the GDP inventory) as the owner approves each one.
 */
export const RECOGNITION_SOURCES: RecognitionSource[] = [trustTransportSource, levelUpTrainerPayoutSource];

/**
 * A USD estimate plus the separately-reported ServiceCredits volume and the per-source breakdown.
 * `usdEstimate` excludes ServiceCredits entirely; `serviceCreditsVolume` is the ServiceCredits-denominated
 * recognized volume in SC units, never converted to USD.
 */
export interface RecognitionBreakdown extends UsdEstimate {
  serviceCreditsVolume: number;
  perSource: Array<{ pluginSlug: string; usdEstimate: number; serviceCredits: number }>;
}

/**
 * Roll recognized volume across every registered source. Convertible (fiat/crypto) volume is normalized
 * to one USD estimate via the active `currency_usd_rates` factors; ServiceCredits-denominated volume is
 * summed separately in SC units and never converted. Both AUGMENT the projection-based GDP target (they
 * do not replace it); the USD figure is labeled an estimate.
 */
export async function recognizeGdpVolume(): Promise<RecognitionBreakdown> {
  const rates = await getActiveUsdRates();
  let usdEstimate = 0;
  let serviceCreditsVolume = 0;
  const unrated = new Set<string>();
  const perSource: Array<{ pluginSlug: string; usdEstimate: number; serviceCredits: number }> = [];
  for (const source of RECOGNITION_SOURCES) {
    const volumes = await source.loadVolumes();
    const sourceServiceCredits = volumes
      .filter((v) => v.currencyCode === SERVICE_CREDITS_CODE)
      .reduce((sum, v) => sum + v.amount, 0);
    const result = normalizeVolumesToUsd(volumes, rates);
    usdEstimate += result.usdEstimate;
    serviceCreditsVolume += sourceServiceCredits;
    result.unratedCurrencies.forEach((code) => unrated.add(code));
    perSource.push({ pluginSlug: source.pluginSlug, usdEstimate: result.usdEstimate, serviceCredits: sourceServiceCredits });
  }
  return { usdEstimate, unratedCurrencies: [...unrated], serviceCreditsVolume, perSource };
}
