import { queryDb } from 'lib/db/postgres';

// Community Value Index recognition (issue #121). This module is the GDP plugin's "value layer": it
// rolls all recognized economic activity across applicable plugins into ONE composite figure — the
// Community Value Index — by weighting each value type (fiat, crypto, ServiceCredits, barter, free) with
// an owner-curated, non-binding contribution weight.
//
// IMPORTANT — the index is NOT money. It is a relative, community-built measure for transparency, in the
// spirit of GDP. The contribution weights (stored in currency_usd_rates, USD used only as the reference
// base = 1) are NEVER surfaced as a price, an exchange rate, or a per-wallet/per-token fiat equivalence.
// The index is displayed as a plain number with no currency symbol; nothing is pegged or redeemable.

/** A single value-type volume to fold into the Community Value Index. */
export interface CurrencyVolume {
  amount: number;
  currencyCode: string;
}

// Barter (a no-money two-way exchange) and Free (one-way mutual aid at no charge) are recognized value
// types selectable as payment kinds. Both are counted in the index by the NUMBER of completed exchanges
// times their contribution weight — never by a monetary amount, because neither carries a price.
export const BARTER_CODE = 'BARTER';
export const FREE_CODE = 'FREE';

/** The composite index plus the value types that had no contribution weight (surfaced, never silently dropped). */
export interface CommunityValueResult {
  /** The Community Value Index — a relative, non-monetary measure. Not dollars; shown without a symbol. */
  valueIndex: number;
  /** Value-type codes with no active contribution weight; excluded and surfaced rather than treated as zero. */
  unweightedCurrencies: string[];
  /** Per-value-type breakdown: the raw recognized volume in that type's own units (SC as SC, BTC as BTC). */
  perCurrency: Array<{ currencyCode: string; amount: number }>;
}

/**
 * The active contribution weight per value type: the most recent `as_of` row per `currency_code` in
 * `currency_usd_rates`. `1` unit of the type contributes `usd_rate` to the Community Value Index, where
 * USD is the reference base (weight 1). These are owner-curated, non-binding weights — not market quotes
 * and not redemption rates. (The table keeps its historical name; it is the index weight table now.)
 */
export async function getActiveContributionWeights(): Promise<Map<string, number>> {
  const result = await queryDb<{ currency_code: string; usd_rate: string }>(
    `SELECT DISTINCT ON (currency_code) currency_code, usd_rate::text AS usd_rate
       FROM currency_usd_rates
       ORDER BY currency_code, as_of DESC`,
  );
  const weights = new Map<string, number>();
  for (const row of result.rows) {
    weights.set(row.currency_code, Number(row.usd_rate));
  }
  return weights;
}

/**
 * Fold a set of value-type volumes into the Community Value Index using the active contribution weights.
 * A value type with no active weight is excluded and reported in `unweightedCurrencies` rather than being
 * silently treated as zero. The output is a relative index, never a monetary figure.
 */
export function foldVolumesIntoIndex(
  volumes: CurrencyVolume[],
  weights: Map<string, number>,
): { valueIndex: number; unweightedCurrencies: string[] } {
  let valueIndex = 0;
  const unweighted = new Set<string>();
  for (const volume of volumes) {
    const weight = weights.get(volume.currencyCode);
    if (weight === undefined) {
      unweighted.add(volume.currencyCode);
      continue;
    }
    valueIndex += volume.amount * weight;
  }
  return { valueIndex, unweightedCurrencies: [...unweighted] };
}

/**
 * A named source of recognizable economic activity — one per contributing plugin. The aggregator rolls
 * these up into the Community Value Index. A source must contribute ONLY eligible settled value — never
 * transfers or deletion/reclaim reallocations, which the non-recognition rules exclude.
 */
export interface RecognitionSource {
  pluginSlug: string;
  label: string;
  /** Load this source's eligible settled value, one entry per value type (server-side). */
  loadVolumes(): Promise<CurrencyVolume[]>;
}

/**
 * TrustTransport: the value of completed marketplace tasks credited to providers. Recognizes the
 * positive earning entries (`credit` + `release`); excludes `debit`/`hold` (internal/pending) and any
 * reclaim/reallocation. Groups by the referenced `price_currency`, falling back to the legacy
 * free-text `currency`; unknown codes are surfaced (not silently dropped) by the aggregator.
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
 * one eligible-value slice of LevelUp — service delivered for validated work. Deliberately EXCLUDES
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
 * Registered recognition sources, one per plugin, owner-approved one at a time. Append other plugins'
 * eligible-value sources here (and document them in the GDP inventory) as the owner approves each one.
 * Barter and free exchanges register as `BARTER`/`FREE`-coded sources (counted by completed-exchange
 * count) once a plugin settles them on-platform via the shared payment selector (issue #420).
 */
export const RECOGNITION_SOURCES: RecognitionSource[] = [trustTransportSource, levelUpTrainerPayoutSource];

/** The composite index plus the per-source contribution breakdown. */
export interface RecognitionBreakdown extends CommunityValueResult {
  perSource: Array<{ pluginSlug: string; valueIndex: number }>;
}

/**
 * Roll recognized value across every registered source into the single Community Value Index, applying
 * the active contribution weights once. Every value type — fiat, crypto, ServiceCredits, barter — folds
 * into the one figure; each type's raw volume is also returned for the per-type breakdown. The index
 * AUGMENTS the projection-based target (it does not replace it) and is always a relative, non-monetary
 * measure.
 */
export async function recognizeCommunityValueIndex(): Promise<RecognitionBreakdown> {
  const weights = await getActiveContributionWeights();
  let valueIndex = 0;
  const unweighted = new Set<string>();
  const perCurrency = new Map<string, number>();
  const perSource: Array<{ pluginSlug: string; valueIndex: number }> = [];
  for (const source of RECOGNITION_SOURCES) {
    const volumes = await source.loadVolumes();
    const result = foldVolumesIntoIndex(volumes, weights);
    valueIndex += result.valueIndex;
    result.unweightedCurrencies.forEach((code) => unweighted.add(code));
    for (const volume of volumes) {
      perCurrency.set(volume.currencyCode, (perCurrency.get(volume.currencyCode) ?? 0) + volume.amount);
    }
    perSource.push({ pluginSlug: source.pluginSlug, valueIndex: result.valueIndex });
  }
  return {
    valueIndex,
    unweightedCurrencies: [...unweighted],
    perCurrency: [...perCurrency].map(([currencyCode, amount]) => ({ currencyCode, amount })),
    perSource,
  };
}
