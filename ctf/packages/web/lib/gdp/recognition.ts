import { queryDb } from 'lib/db/postgres';
import { PER_OCCURRENCE_ORIGIN_PLUGINS, cadenceMonthlyFactorSql } from 'lib/recurring-activity/types';

// Community Value Index recognition (issue #121). This module is the GDP plugin's "value layer": it
// rolls all recognized economic activity across applicable plugins into ONE composite figure — the
// Community Value Index — by weighting each value type (fiat, crypto, ServiceCredits, barter, free) with
// a fixed, built-in contribution weight (DEFAULT_CONTRIBUTION_WEIGHTS below). The weights live in code,
// not in a database or an admin screen, so the index is always live and needs no owner action.
//
// IMPORTANT — the index is NOT money. It is a relative measure for transparency, in the spirit of GDP.
// The contribution weights (USD used only as the reference base = 1) are NEVER surfaced as a price, an
// exchange rate, or a per-wallet/per-token fiat equivalence. The index is displayed as a plain number
// with no currency symbol; nothing is pegged or redeemable.

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
 * Built-in contribution weight per value type: how many index points one unit of that type adds to the
 * Community Value Index. These are FIXED in code — there is no admin or database step — so the index is
 * always live and needs no owner action. (The owner-curated currency-rate admin that used to hold these
 * was retired; the index must never go dark waiting for someone to set a weight.) ServiceCredits is the
 * community's native unit and counts 1:1, so real ServiceCredits activity is visible immediately; each
 * completed non-money exchange (FREE favor, BARTER trade) counts one point; foreign-currency settled
 * value normalizes to a USD reference so it is counted, not dropped.
 *
 * IMPORTANT — these are notional index weights, never money. The index is shown with NO currency symbol
 * and is never a price, an exchange rate, a redemption value, or a per-wallet/per-token fiat equivalence.
 * A `SC` weight of 1 is NOT a claim that one ServiceCredit equals one US dollar; ServiceCredits remains
 * non-convertible. A value type absent from this map is surfaced and excluded, never silently zeroed.
 */
export const DEFAULT_CONTRIBUTION_WEIGHTS: Map<string, number> = new Map([
  // Native unit — counts 1:1 so a single ServiceCredit of recognized activity shows as one index point.
  ['SC', 1],
  // Non-money exchanges: one completed act of value counts as one point each.
  [FREE_CODE, 1],
  [BARTER_CODE, 1],
  // Recurring activity, by count: one point per confirmed fiat recurring line (see
  // RECURRING_ACTIVITY_COUNT_UNIT below — a hidden unit, never a fiat amount). This mirrors the weekly
  // job's weight map in scripts/recognizeGdp.mjs, which has always carried it; the live map was missed
  // when the weights moved out of the database and into code, so every confirmed fiat recurring line
  // was being surfaced as unweighted and excluded from the live index instead of counting one point.
  ['RACT', 1],
  // Foreign-currency settled value, normalized to a USD reference (USD = 1). Notional index inputs only,
  // never a price or redemption rate — present so a foreign-priced completed task is counted, not dropped.
  ['USD', 1],
  ['EUR', 1.08],
  ['GBP', 1.27],
  ['CHF', 1.12],
  ['CAD', 0.73],
  ['AUD', 0.66],
  ['CNY', 0.14],
  ['INR', 0.012],
  ['BRL', 0.18],
  ['JPY', 0.0067],
  ['BTC', 65000],
]);

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
 * Foundation completed priced quotes: a survivor pays a provider a real fiat/crypto (or ServiceCredits)
 * amount for a one-off engagement quoted through a Foundation connection thread. When a provider responds
 * they attach `quoted_amount` in `quoted_currency`; on close, if the quote carried a value, `settled_at`
 * is stamped and the settled value is recognized per currency. We read only closed, settled rows and group
 * by currency so each value type folds into the index with its own contribution weight. This does NOT
 * overlap with `foundationCallSource`: that source reads a different table (`foundation_call_sessions`,
 * the metered ServiceCredits "Connect now" calls), while this reads `foundation_quote_requests` (one-off
 * priced quotes) — two distinct settled-value streams, so nothing is double-counted. Recurring
 * engagements are out of scope here and captured instead by the Recurring Activity source.
 */
export const foundationQuoteSource: RecognitionSource = {
  pluginSlug: 'foundation',
  label: 'Foundation completed quotes',
  async loadVolumes() {
    const result = await queryDb<{ currency_code: string | null; total: string | null }>(
      `SELECT quoted_currency AS currency_code, SUM(quoted_amount)::text AS total
         FROM foundation_quote_requests
         WHERE lifecycle_state = 'closed' AND settled_at IS NOT NULL
           AND quoted_amount IS NOT NULL AND quoted_currency IS NOT NULL
         GROUP BY quoted_currency`,
    );
    return result.rows
      .filter((r) => Boolean(r.currency_code) && Number(r.total) > 0)
      .map((r) => ({ amount: Number(r.total), currencyCode: r.currency_code as string }));
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
 * LightHouse housing arrangements: a seeker asked to stay at a listed home and the host accepted, so a
 * real housing arrangement was made. Read from `lighthouse_matches` joined to the listing, counting a
 * match once in `accepted` or `completed` (the same arrangement in two lifecycle states — never twice).
 *
 * ONE month of the listed rent is recognized per arrangement: the arrangement that was actually made
 * here. Every month after that is not LightHouse's to count — the pair declares the ongoing
 * relationship in Recurring Activity, which recognizes it by count for fiat, so the two sources cover
 * different periods of the same tenancy and never overlap. This is why LightHouse can be recognized
 * without the platform ever holding a running rent total.
 *
 * A listing with no priced rent (`monthly_rent` of zero or NULL — the host form's "0 for
 * ServiceCredits / free") records no amount anywhere, so an accepted match on one counts as a single
 * FREE exchange, exactly like a completed SocketRelay favor. Housing given at no charge is real value;
 * an amount that was never recorded is never invented.
 */
export const lighthouseHousingSource: RecognitionSource = {
  pluginSlug: 'lighthouse',
  label: 'LightHouse housing arrangements',
  async loadVolumes() {
    const result = await queryDb<{ currency_code: string; total: string }>(
      `SELECT CASE WHEN p.monthly_rent > 0 AND p.rent_currency IS NOT NULL THEN p.rent_currency ELSE $1 END AS currency_code,
              SUM(CASE WHEN p.monthly_rent > 0 AND p.rent_currency IS NOT NULL THEN p.monthly_rent ELSE 1 END)::text AS total
         FROM lighthouse_matches m
         JOIN lighthouse_properties p ON p.id = m.property_id
         WHERE m.status IN ('accepted', 'completed')
         GROUP BY 1`,
      [FREE_CODE],
    );
    return result.rows
      .filter((row) => Number(row.total) > 0)
      .map((row) => ({ amount: Number(row.total), currencyCode: row.currency_code }));
  },
};

/**
 * SocketRelay favors: SocketRelay is mutual aid — most favors are given free, and a fulfillment carries
 * no price/currency, so there is no money amount to sum. We recognize each successfully-completed favor
 * as one `FREE` exchange (counted by completed-exchange count, the way the index treats BARTER/FREE),
 * read from `socket_relay_fulfillments` where `close_reason = 'successful'`. Unsuccessful, reopened, or
 * canceled favors do not count. We deliberately do NOT also count SocketRelay's standalone
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
 *   - ServiceCredits lines (currency_code = 'SC'): counted by their declared `sc_value`, scaled to a
 *     MONTHLY figure by the line's cadence (`CADENCE_MONTHLY_FACTOR`) so a weekly arrangement and a
 *     monthly one moving the same credits over a year count the same. Before that scaling, a weekly 50
 *     and a monthly 50 both contributed 50, which read a weekly arrangement as a twelfth of what it is.
 *     ServiceCredits is an internal utility token with no third-party reporting duty. This is a DECLARED
 *     figure, never an executed transfer, so it never touches real balances and never double-counts the
 *     direct ServiceCredits transfer source (which reads `service_credits_transfers`, a different
 *     table). Fiat lines are unaffected: they are counted by NUMBER of relationships, not by period.
 *
 * One exception keeps a declared value from counting twice. Members can now mark an activity as
 * recurring from inside the app they are already in, and that app is recorded on the row as
 * `origin_plugin`. Some of those apps settle EVERY exchange on-platform and are already recognized per
 * occurrence — a Foundation call per minute-block, a TrustTransport trip per trip, a SocketRelay favor
 * per favor. Counting a declared ServiceCredits value from one of those would count the same credits a
 * second time, so those lines are recognized as a RELATIONSHIP (one point, like a fiat line) rather than
 * as value. LightHouse is deliberately not in that set: it records the arrangement once and never sees
 * the months that follow, so the declared value there is the only record of them. A line declared in the
 * Recurring Activity plugin itself has no origin and is counted by value as before.
 */
export const recurringActivitySource: RecognitionSource = {
  pluginSlug: 'recurring-activity',
  label: 'Recurring peer activities (confirmed)',
  async loadVolumes() {
    const [fiatCount, scValue, perOccurrenceScCount] = await Promise.all([
      queryDb<{ total: string | null }>(
        `SELECT COUNT(*)::text AS total
           FROM recurring_activities
          WHERE status = 'active' AND currency_code <> 'SC'`,
      ),
      // ServiceCredits lines counted by DECLARED value — but only where that declared value is the
      // only record of the exchange. A line declared inside an app that already settles every single
      // exchange on-platform is excluded here and counted as a relationship below instead, so the same
      // credits are never counted twice (see PER_OCCURRENCE_ORIGIN_PLUGINS).
      queryDb<{ total: string | null }>(
        `SELECT SUM(sc_value * (${cadenceMonthlyFactorSql()}))::text AS total
           FROM recurring_activities
          WHERE status = 'active' AND currency_code = 'SC' AND sc_value IS NOT NULL
            AND (origin_plugin IS NULL OR origin_plugin <> ALL($1::text[]))`,
        [PER_OCCURRENCE_ORIGIN_PLUGINS],
      ),
      // The ones just excluded: still real ongoing relationships, so each counts one point, exactly the
      // way a fiat line does. Recognized as a relationship, never a second time as value.
      queryDb<{ total: string | null }>(
        `SELECT COUNT(*)::text AS total
           FROM recurring_activities
          WHERE status = 'active' AND currency_code = 'SC'
            AND origin_plugin = ANY($1::text[])`,
        [PER_OCCURRENCE_ORIGIN_PLUGINS],
      ),
    ]);
    const volumes: CurrencyVolume[] = [];
    const fiat = Number(fiatCount.rows[0]?.total ?? 0);
    const relationshipsOnly = Number(perOccurrenceScCount.rows[0]?.total ?? 0);
    const countedByRelationship =
      (Number.isFinite(fiat) ? fiat : 0) + (Number.isFinite(relationshipsOnly) ? relationshipsOnly : 0);
    if (countedByRelationship > 0) {
      volumes.push({ amount: countedByRelationship, currencyCode: RECURRING_ACTIVITY_COUNT_UNIT });
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
 * thank-you grants (all incentive mints).
 *
 * How an ongoing arrangement is split between two sources: the plugin where the arrangement was made
 * recognizes the value of making it — a LightHouse match recognizes one month of the listed rent — and
 * every period after that belongs to the Recurring Activity source above (issue #885), where the pair
 * declares the ongoing relationship themselves and it is counted by number for fiat and by declared
 * value for ServiceCredits. No plugin holds a running rent or subscription total, and no month is
 * counted twice. Append a source here (and document it in the GDP inventory) when a plugin starts
 * recording settled value.
 */
export const RECOGNITION_SOURCES: RecognitionSource[] = [
  trustTransportSource,
  levelUpTrainerPayoutSource,
  foundationCallSource,
  // Distinct from foundationCallSource above: reads foundation_quote_requests (one-off priced quotes),
  // not foundation_call_sessions (metered ServiceCredits calls) — no overlap, no double count.
  foundationQuoteSource,
  serviceCreditsDirectTransferSource,
  chymeTipSource,
  lighthouseHousingSource,
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
  const weights = DEFAULT_CONTRIBUTION_WEIGHTS;
  let valueIndex = 0;
  const unweighted = new Set<string>();
  const perCurrency = new Map<string, number>();
  const perSource: Array<{ pluginSlug: string; label: string; valueIndex: number }> = [];
  // Each source's loadVolumes() is an independent, read-only DB round trip, and this runs live on every
  // dashboard request — so fire them concurrently instead of awaiting one at a time. Promise.all keeps
  // result order, so the folded per-source breakdown stays in the same RECOGNITION_SOURCES order it had
  // when this loop was sequential. Failure semantics are unchanged: if any source throws, the whole
  // recognition rejects, exactly as the sequential await did.
  const volumesBySource = await Promise.all(RECOGNITION_SOURCES.map((source) => source.loadVolumes()));
  RECOGNITION_SOURCES.forEach((source, index) => {
    const volumes = volumesBySource[index];
    const result = foldVolumesIntoIndex(volumes, weights);
    valueIndex += result.valueIndex;
    result.unweightedCurrencies.forEach((code) => unweighted.add(code));
    for (const volume of volumes) {
      perCurrency.set(volume.currencyCode, (perCurrency.get(volume.currencyCode) ?? 0) + volume.amount);
    }
    perSource.push({ pluginSlug: source.pluginSlug, label: source.label, valueIndex: result.valueIndex });
  });
  return {
    valueIndex,
    unweightedCurrencies: [...unweighted],
    perCurrency: [...perCurrency].map(([currencyCode, amount]) => ({ currencyCode, amount })),
    perSource,
  };
}
