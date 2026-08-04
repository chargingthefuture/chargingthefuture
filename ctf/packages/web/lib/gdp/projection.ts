import { queryDb } from 'lib/db/postgres';
import { cadenceMonthlyFactorSql } from 'lib/recurring-activity/types';
import {
  DEFAULT_CONTRIBUTION_WEIGHTS,
  FREE_CODE,
  RECURRING_ACTIVITY_COUNT_UNIT,
  foldVolumesIntoIndex,
  type CurrencyVolume,
} from 'lib/gdp/recognition';

// Projected value — the "what is still on the board" figure for the GDP surface.
//
// The Community Value Index (lib/gdp/recognition.ts) only counts value that actually settled: a task
// completed, a call charged, a favor closed successfully. That is the honest measure and it must stay
// exactly as it is. But a community that has just opened has plenty of real posts and almost nothing
// closed yet, so the index sits near zero while the board is busy. This module measures that busy board:
// every open, not-yet-closed post that carries a value, folded with the SAME contribution weights, into
// a SEPARATE figure.
//
// Three hard rules, and the whole point of keeping this in its own file:
//   1. NOTHING here is ever added to the Community Value Index. `recognizeCommunityValueIndex` does not
//      import this module and never will; the two figures are computed by different functions, carried
//      in different fields, and labeled differently on screen.
//   2. NOTHING here is ever written to `gdp_metric_snapshots` or read by the weekly
//      `scripts/recognizeGdp.mjs` job. This is a live, read-only view.
//   3. Every source below reads rows the recognition sources deliberately skip (open instead of
//      settled), so a post can never be counted in both figures at once. When a post finally closes it
//      leaves this figure and enters the real index.
//
// Like the index, this is NOT money: no currency symbol, no price, no exchange or redemption value.
// It is a count of posted intent, and most posted intent never closes.

/** A named source of open, not-yet-closed posts that carry a value. */
export interface ProjectionSource {
  pluginSlug: string;
  label: string;
  /** Load this source's open (unsettled) posted value, one entry per value type (server-side). */
  loadVolumes(): Promise<CurrencyVolume[]>;
}

/**
 * TrustTransport open requests: a ride/delivery posted with a settlement type chosen, not yet completed.
 * Priced types (ServiceCredits, fiat, crypto) carry `price_amount`; Free and Barter carry none and are
 * counted one point per post, exactly the way the index counts a completed FREE/BARTER exchange. Only
 * live states count — `open`, `accepted`, `in_progress` — so a canceled, disputed, frozen, or completed
 * request contributes nothing. Completed requests are already recognized for real through
 * `trust_transport_earnings_ledger`, so nothing is double-counted between the two figures.
 */
export const trustTransportOpenRequestSource: ProjectionSource = {
  pluginSlug: 'trust-transport',
  label: 'TrustTransport requests still open',
  async loadVolumes() {
    const result = await queryDb<{ currency_code: string; total: string }>(
      `SELECT price_currency AS currency_code,
              SUM(CASE WHEN price_amount IS NULL THEN 1 ELSE price_amount END)::text AS total
         FROM trust_transport_requests
         WHERE status IN ('open', 'accepted', 'in_progress')
           AND price_currency IS NOT NULL
         GROUP BY price_currency`,
    );
    return result.rows
      .filter((row) => Number(row.total) > 0)
      .map((row) => ({ amount: Number(row.total), currencyCode: row.currency_code }));
  },
};

/**
 * Foundation quotes on the table: a provider has answered a request with a price, and the survivor has
 * not closed it yet (`lifecycle_state = 'provider_responded'`). A quote still in `requested` carries no
 * price, so there is nothing to project; a `closed` quote with `settled_at` is already counted for real
 * by the recognition source. Grouped by the quoted value type.
 */
export const foundationOpenQuoteSource: ProjectionSource = {
  pluginSlug: 'foundation',
  label: 'Foundation quotes awaiting a decision',
  async loadVolumes() {
    const result = await queryDb<{ currency_code: string; total: string }>(
      `SELECT quoted_currency AS currency_code, SUM(quoted_amount)::text AS total
         FROM foundation_quote_requests
         WHERE lifecycle_state = 'provider_responded'
           AND quoted_amount IS NOT NULL AND quoted_currency IS NOT NULL
         GROUP BY quoted_currency`,
    );
    return result.rows
      .filter((row) => Number(row.total) > 0)
      .map((row) => ({ amount: Number(row.total), currencyCode: row.currency_code }));
  },
};

/**
 * LightHouse homes still available: an active listing that nobody has been accepted into yet. The
 * listing IS the post here — a home offered, waiting for a seeker — so it is projected the same way an
 * open ride or an unclaimed favor is, at ONE month of the listed rent (the same unit the recognition
 * source uses when a match is accepted, so the number simply moves from this figure into the real index
 * when a host says yes).
 *
 * A listing with an accepted or completed match is excluded: that home is recognized for real and must
 * not also sit here. Pending requests against a listing are deliberately NOT counted separately either —
 * a home with three people asking is still one home, and counting the asks would inflate the figure.
 * A listing with no priced rent counts as one FREE exchange, matching the recognition treatment.
 */
export const lighthouseOpenListingSource: ProjectionSource = {
  pluginSlug: 'lighthouse',
  label: 'LightHouse homes still available',
  async loadVolumes() {
    const result = await queryDb<{ currency_code: string; total: string }>(
      `SELECT CASE WHEN p.monthly_rent > 0 AND p.rent_currency IS NOT NULL THEN p.rent_currency ELSE $1 END AS currency_code,
              SUM(CASE WHEN p.monthly_rent > 0 AND p.rent_currency IS NOT NULL THEN p.monthly_rent ELSE 1 END)::text AS total
         FROM lighthouse_properties p
         WHERE p.is_active = true
           AND NOT EXISTS (
             SELECT 1 FROM lighthouse_matches m
              WHERE m.property_id = p.id AND m.status IN ('accepted', 'completed')
           )
         GROUP BY 1`,
      [FREE_CODE],
    );
    return result.rows
      .filter((row) => Number(row.total) > 0)
      .map((row) => ({ amount: Number(row.total), currencyCode: row.currency_code }));
  },
};

/**
 * SocketRelay favors waiting to be done: a favor posted (`open`) or picked up but not yet closed
 * (`claimed`), and not past its 28-day expiry. A favor carries no price, so each one counts as a single
 * FREE exchange — the same unit the index uses for a favor that closed successfully. Expired, closed,
 * and canceled posts contribute nothing.
 */
export const socketRelayOpenFavorSource: ProjectionSource = {
  pluginSlug: 'socket-relay',
  label: 'SocketRelay favors waiting to be done',
  async loadVolumes() {
    const result = await queryDb<{ total: string | null }>(
      `SELECT COUNT(*)::text AS total
         FROM socket_relay_requests
         WHERE status IN ('open', 'claimed')
           AND (expires_at IS NULL OR expires_at > NOW())`,
    );
    const total = Number(result.rows[0]?.total ?? 0);
    if (!Number.isFinite(total) || total <= 0) {
      return [];
    }
    return [{ amount: total, currencyCode: FREE_CODE }];
  },
};

/**
 * Recurring activities awaiting confirmation: one member has declared an ongoing activity with another
 * and the other has not confirmed it yet (`status = 'pending'`). Counted with the same firewall the
 * confirmed source uses — fiat lines by NUMBER (one hidden RACT unit each, because a fiat line stores no
 * amount by design), ServiceCredits lines by their declared `sc_value`, scaled to a monthly figure by
 * cadence exactly as the confirmed source scales it. Confirmed (`active`) rows are counted for real by
 * the recognition source, so the two never overlap.
 */
export const recurringActivityPendingSource: ProjectionSource = {
  pluginSlug: 'recurring-activity',
  label: 'Recurring activities awaiting confirmation',
  async loadVolumes() {
    const [fiatCount, scValue] = await Promise.all([
      queryDb<{ total: string | null }>(
        `SELECT COUNT(*)::text AS total
           FROM recurring_activities
          WHERE status = 'pending' AND currency_code <> 'SC'`,
      ),
      queryDb<{ total: string | null }>(
        // Scaled to a monthly figure by cadence, the same way the confirmed source counts it, so a line
        // contributes the same before and after it is confirmed.
        `SELECT SUM(sc_value * (${cadenceMonthlyFactorSql()}))::text AS total
           FROM recurring_activities
          WHERE status = 'pending' AND currency_code = 'SC' AND sc_value IS NOT NULL`,
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
 * Registered projection sources. The policy mirrors the recognition policy with one word changed:
 * recognize only non-incentive value, but read the OPEN row instead of the settled one. Never an
 * incentive (reward, bonus, stipend, thank-you mint) and never a reallocation.
 *
 * Deliberately NOT projected:
 *   - Skills Hunt, Unlock, and Contributions posts. Their value moves are incentive mints, which are
 *     excluded from the real index and must stay excluded here.
 *   - Feed posts, directory profiles, announcements. Not exchanges; they carry no value to project.
 *   - TrustTransport pending offers and LightHouse pending match requests. Each sits against a post
 *     this list already counts, so counting them would count one job, or one home, twice.
 */
export const PROJECTION_SOURCES: ProjectionSource[] = [
  trustTransportOpenRequestSource,
  foundationOpenQuoteSource,
  lighthouseOpenListingSource,
  socketRelayOpenFavorSource,
  recurringActivityPendingSource,
];

/** One source's contribution to the projected figure. */
export interface ProjectedSourceContribution {
  pluginSlug: string;
  label: string;
  valueIndex: number;
  /** How many open posts this source is reporting, for the plain "N posts still open" line. */
  openCount: number;
}

export interface ProjectionBreakdown {
  /** The projected figure. A separate number from the Community Value Index; never added to it. */
  projectedValueIndex: number;
  /** Total number of open posts behind the figure, across every source. */
  openPostCount: number;
  /** Value types with no contribution weight; excluded and surfaced rather than silently zeroed. */
  unweightedCurrencies: string[];
  perSource: ProjectedSourceContribution[];
}

/**
 * Count how many open posts a set of volumes represents. A FREE/BARTER/RACT volume is already a count of
 * posts, so its amount IS the post count; a priced volume is one amount summed across an unknown number
 * of posts, so it counts as at least one post. This drives the plain-language "N posts still open" line
 * only — it never feeds the figure itself.
 */
export function countOpenPosts(volumes: CurrencyVolume[]): number {
  const COUNT_UNITS = new Set([FREE_CODE, 'BARTER', RECURRING_ACTIVITY_COUNT_UNIT]);
  return volumes.reduce(
    (total, volume) => total + (COUNT_UNITS.has(volume.currencyCode) ? volume.amount : 1),
    0,
  );
}

/**
 * Roll every registered projection source into the single projected figure, applying the same
 * contribution weights the real index uses so the two numbers are on the same scale and can be read side
 * by side. Read-only: nothing here writes a snapshot, and the result is carried in its own field of the
 * live report so no caller can mistake it for the Community Value Index.
 */
export async function projectOpenValueIndex(): Promise<ProjectionBreakdown> {
  const weights = DEFAULT_CONTRIBUTION_WEIGHTS;
  let projectedValueIndex = 0;
  let openPostCount = 0;
  const unweighted = new Set<string>();
  const perSource: ProjectedSourceContribution[] = [];
  // Each source is an independent read-only round trip and this runs live on every dashboard request,
  // so fire them concurrently. Promise.all keeps order, so the breakdown stays in PROJECTION_SOURCES
  // order. If any source throws, the whole projection rejects and the caller drops the panel — the real
  // index is computed separately and is never affected.
  const volumesBySource = await Promise.all(PROJECTION_SOURCES.map((source) => source.loadVolumes()));
  PROJECTION_SOURCES.forEach((source, index) => {
    const volumes = volumesBySource[index];
    const result = foldVolumesIntoIndex(volumes, weights);
    const posts = countOpenPosts(volumes);
    projectedValueIndex += result.valueIndex;
    openPostCount += posts;
    result.unweightedCurrencies.forEach((code) => unweighted.add(code));
    perSource.push({
      pluginSlug: source.pluginSlug,
      label: source.label,
      valueIndex: result.valueIndex,
      openCount: posts,
    });
  });
  return {
    projectedValueIndex,
    openPostCount,
    unweightedCurrencies: [...unweighted],
    perSource,
  };
}
