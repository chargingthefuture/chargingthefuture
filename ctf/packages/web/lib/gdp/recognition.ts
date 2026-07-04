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
  pluginSlug: 'trust-transport',
  label: 'TrustTransport completed-task earnings',
  async loadVolumes() {
    const result = await queryDb<{ currency_code: string | null; total: string }>(
      `SELECT COALESCE(price_currency, currency) AS currency_code, SUM(amount)::text AS total
         FROM trust_transport_earnings_ledger
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
  pluginSlug: 'level-up',
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
 * Foundation: ServiceCredits a caller pays a provider for a metered 1:1 "Connect now" service call.
 * Each minute-block charges the provider's locked rate, and `foundation_call_sessions` snapshots that
 * rate (`rate_credits_locked`) and the number of paid blocks (`blocks_charged`), so the total settled
 * value of a call is `blocks_charged * rate_credits_locked` ServiceCredits (code `SC`). This is real
 * service-delivery value — a survivor paying another survivor for a consultation — so it is recognized,
 * exactly like TrustTransport's completed-task earnings. We read Foundation's OWN call-session record
 * (not the SC transfer ledger): the ledger tags these caller→provider moves `accounting_scope =
 * service_credits_non_gdp` because, as raw transfers, they must not be counted blindly; the curated
 * per-call record here is the eligible-settled-value view. Only calls that actually charged at least one
 * block count; rings that never answered (no rate, zero blocks) contribute nothing.
 */
export const foundationCallSource: RecognitionSource = {
  pluginSlug: 'foundation',
  label: 'Foundation paid service calls',
  async loadVolumes() {
    const result = await queryDb<{ total: string | null }>(
      `SELECT SUM(blocks_charged * rate_credits_locked)::text AS total
         FROM foundation_call_sessions
         WHERE blocks_charged > 0 AND rate_credits_locked IS NOT NULL`,
    );
    const total = Number(result.rows[0]?.total ?? 0);
    if (!Number.isFinite(total) || total <= 0) {
      return [];
    }
    return [{ amount: total, currencyCode: 'SC' }];
  },
};

/**
 * Direct ServiceCredits transfers: a member sending another member credits from the ServiceCredits
 * "Send Credits" form — genuine peer-to-peer economic activity that is NOT tied to any plugin
 * transaction. We read the curated `service_credits_transfers` record (one row per transfer, an `amount`
 * in ServiceCredits) for COMPLETED sends whose `origin_plugin = 'service-credits'`. This is the only
 * transfer source read directly from the transfers table; plugin-mediated transfers carry their own
 * `origin_plugin` and are counted (or not) by that plugin's source, so there is no double count. Counts
 * nothing until a send actually delivers — a transfer is `completed` only once the recipient is credited
 * (fixed so a send delivers immediately rather than parking in escrow). Never an incentive: mints live in
 * `service_credits_governance_events`, not here.
 */
export const serviceCreditsDirectTransferSource: RecognitionSource = {
  pluginSlug: 'service-credits',
  label: 'Direct ServiceCredits transfers',
  async loadVolumes() {
    const result = await queryDb<{ total: string | null }>(
      `SELECT SUM(amount)::text AS total
         FROM service_credits_transfers
         WHERE status = 'completed' AND origin_plugin = 'service-credits'`,
    );
    const total = Number(result.rows[0]?.total ?? 0);
    if (!Number.isFinite(total) || total <= 0) {
      return [];
    }
    return [{ amount: total, currencyCode: 'SC' }];
  },
};

/**
 * Chyme peer tips: a member tipping another member in a Chyme audio room, recorded as a COMPLETED
 * `service_credits_transfers` row with `origin_plugin = 'chyme'`. Read the same way as direct transfers
 * but attributed to Chyme. NOTE: the Chyme tip backend exists but is not yet wired to a UI, so this
 * reads zero until tipping is connected — it is registered now so the value is counted automatically the
 * moment real tips start flowing. Never an incentive.
 */
export const chymeTipSource: RecognitionSource = {
  pluginSlug: 'chyme',
  label: 'Chyme peer tips',
  async loadVolumes() {
    const result = await queryDb<{ total: string | null }>(
      `SELECT SUM(amount)::text AS total
         FROM service_credits_transfers
         WHERE status = 'completed' AND origin_plugin = 'chyme'`,
    );
    const total = Number(result.rows[0]?.total ?? 0);
    if (!Number.isFinite(total) || total <= 0) {
      return [];
    }
    return [{ amount: total, currencyCode: 'SC' }];
  },
};

/**
 * SocketRelay favors: SocketRelay is mutual aid — most favors are given free, and a fulfillment carries
 * no price/currency, so there is no money amount to sum. We recognize each successfully-completed favor
 * as one `FREE` exchange (counted by completed-exchange count, the way the index treats BARTER/FREE),
 * read from `socket_relay_fulfillments` where `close_reason = 'successful'`. Unsuccessful, reopened, or
 * cancelled favors do not count. We deliberately do NOT also count SocketRelay's standalone
 * ServiceCredits transfer route here: it is rare, unlinked to a fulfillment, and counting both could
 * double-count one favor; the completed-favor count is the mutual-aid value SocketRelay actually
 * settles. If `FREE` has no active contribution weight it is surfaced and excluded, never zeroed.
 */
export const socketRelayFavorSource: RecognitionSource = {
  pluginSlug: 'socket-relay',
  label: 'SocketRelay completed favors',
  async loadVolumes() {
    const result = await queryDb<{ total: string | null }>(
      `SELECT COUNT(*)::text AS total
         FROM socket_relay_fulfillments
         WHERE close_reason = 'successful'`,
    );
    const total = Number(result.rows[0]?.total ?? 0);
    if (!Number.isFinite(total) || total <= 0) {
      return [];
    }
    return [{ amount: total, currencyCode: FREE_CODE }];
  },
};

// The internal counting unit for fiat-denominated recurring activities. Each confirmed, active fiat
// recurring activity contributes ONE RACT to the index (weighted by RACT's owner-curated weight,
// default 1) — a COUNT, never a fiat amount. RACT is a hidden (is_active = FALSE) currencies row, so
// it never appears in any member-facing selector; it exists only as this weight anchor. See schema.sql.
export const RECURRING_ACTIVITY_COUNT_UNIT = 'RACT';

/**
 * Recurring Activity: members' self-declared, counterparty-CONFIRMED ongoing activities with one other
 * member (issue #885). Unlike every other source, this recognizes ATTESTED recurring activity, not a
 * settled exchange — a deliberate, owner-approved relaxation for this plugin — so it lives in its own
 * clearly-labeled bucket and never contaminates the settled-value sources. Only `active` (confirmed)
 * rows count. Two firewalled treatments:
 *   - Fiat lines (currency_code <> 'SC'): counted by NUMBER of activities, one RACT each. A fiat line
 *     carries NO amount (the schema never stores one), so the platform never holds a summable
 *     recurring-fiat-payment total — the whole point of the plugin.
 *   - ServiceCredits lines (currency_code = 'SC'): counted by their declared `sc_value`. ServiceCredits
 *     is an internal utility token with no third-party reporting duty. This is a DECLARED figure, never
 *     an executed transfer, so it never touches real balances and never double-counts the direct
 *     ServiceCredits transfer source (which reads `service_credits_transfers`, a different table).
 */
export const recurringActivitySource: RecognitionSource = {
  pluginSlug: 'recurring-activity',
  label: 'Recurring peer activities (confirmed)',
  async loadVolumes() {
    const [fiatCount, scValue] = await Promise.all([
      queryDb<{ total: string | null }>(
        `SELECT COUNT(*)::text AS total
           FROM recurring_activities
          WHERE status = 'active' AND currency_code <> 'SC'`,
      ),
      queryDb<{ total: string | null }>(
        `SELECT SUM(sc_value)::text AS total
           FROM recurring_activities
          WHERE status = 'active' AND currency_code = 'SC' AND sc_value IS NOT NULL`,
      ),
    ]);
    const volumes: CurrencyVolume[] = [];
    const fiat = Number(fiatCount.rows[0]?.total ?? 0);
    if (Number.isFinite(fiat) && fiat > 0) {
      volumes.push({ amount: fiat, currencyCode: RECURRING_ACTIVITY_COUNT_UNIT });
    }
    const sc = Number(scValue.rows[0]?.total ?? 0);
    if (Number.isFinite(sc) && sc > 0) {
      volumes.push({ amount: sc, currencyCode: 'SC' });
    }
    return volumes;
  },
};

/**
 * Registered recognition sources, one per plugin. The policy: recognize ONLY non-incentive settled
 * value — value actually delivered/exchanged on-platform — and never an incentive (a reward, bonus,
 * stipend, completion grant, or "thank-you" mint) or a deletion/reclaim reallocation. A genuine
 * peer-to-peer transfer that is NOT part of a plugin transaction IS economic activity and is counted
 * (the direct ServiceCredits source); plugin-mediated transfers are attributed to each plugin by
 * `origin_plugin`, so nothing is double-counted and the ledger is never blindly summed. Concretely
 * excluded today: Skills Hunt accept rewards, Unlock verification incentives, and Contributions
 * thank-you grants (all incentive mints). Recurring off-platform relationships (LightHouse rent,
 * ongoing Foundation services, standing SocketRelay favors) are captured instead by the Recurring
 * Activity source above (issue #885): a self-declared, counterparty-confirmed activity, counted by
 * number for fiat and by declared value for ServiceCredits — never a settled fiat amount, so the
 * platform stays a peer-to-peer marketplace and never holds a recurring-fiat-payment record. Append a
 * source here (and document it in the GDP inventory) when a plugin starts recording settled value.
 */
export const RECOGNITION_SOURCES: RecognitionSource[] = [
  trustTransportSource,
  levelUpTrainerPayoutSource,
  foundationCallSource,
  serviceCreditsDirectTransferSource,
  chymeTipSource,
  socketRelayFavorSource,
  recurringActivitySource,
];

/** The composite index plus the per-source contribution breakdown (label included for display). */
export interface RecognitionBreakdown extends CommunityValueResult {
  perSource: Array<{ pluginSlug: string; label: string; valueIndex: number }>;
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
  const perSource: Array<{ pluginSlug: string; label: string; valueIndex: number }> = [];
  for (const source of RECOGNITION_SOURCES) {
    const volumes = await source.loadVolumes();
    const result = foldVolumesIntoIndex(volumes, weights);
    valueIndex += result.valueIndex;
    result.unweightedCurrencies.forEach((code) => unweighted.add(code));
    for (const volume of volumes) {
      perCurrency.set(volume.currencyCode, (perCurrency.get(volume.currencyCode) ?? 0) + volume.amount);
    }
    perSource.push({ pluginSlug: source.pluginSlug, label: source.label, valueIndex: result.valueIndex });
  }
  return {
    valueIndex,
    unweightedCurrencies: [...unweighted],
    perCurrency: [...perCurrency].map(([currencyCode, amount]) => ({ currencyCode, amount })),
    perSource,
  };
}
