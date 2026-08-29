// Community Value Index SQL shared by the operational scripts (the weekly rollup
// scripts/recognizeGdp.mjs and the weekly community-stats draft
// scripts/generate-community-stats.mjs). These lists mirror the app-side value layer —
// RECOGNITION_SOURCES mirrors ctf/packages/web/lib/gdp/recognition.ts and PROJECTION_SOURCES mirrors
// ctf/packages/web/lib/gdp/projection.ts — keep the three in step when a source changes.
//
// IMPORTANT: the Community Value Index is NOT money. It is a relative measure with no currency
// symbol; the contribution weights (USD is the reference base = 1) are never a price, an exchange
// rate, or a redemption value. The projected figure is a separate number from the index and is never
// added to it: recognition reads settled rows, projection reads the open rows recognition skips, so a
// post is in exactly one figure at a time.

// Fixed, built-in contribution weights — mirror DEFAULT_CONTRIBUTION_WEIGHTS in
// ctf/packages/web/lib/gdp/recognition.ts. There is no database or admin step, so the index is always
// live and needs no owner action. ServiceCredits is the native unit and counts 1:1; each completed
// non-money exchange (FREE favor, BARTER trade) counts one point; foreign-currency settled value
// normalizes to a USD reference. RACT (recurring activity, a by-count code) counts one point per
// confirmed line. Notional index weights only — never a price, exchange rate, or redemption value.
export const WEIGHTS = new Map([
  ['SC', 1],
  ['FREE', 1],
  ['BARTER', 1],
  ['RACT', 1],
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

// One per contributing plugin: a SQL query returning (currency_code, total) of eligible settled
// spend. Only non-incentive settled value is recognized — never a reward/bonus/stipend mint and never
// a deletion/reclaim reallocation.
export const RECOGNITION_SOURCES = [
  {
    pluginSlug: 'trust-transport',
    sql: `SELECT COALESCE(price_currency, currency) AS currency_code, SUM(amount)::numeric AS total
            FROM trust_transport_earnings_ledger
            WHERE entry_type IN ('credit', 'release')
            GROUP BY COALESCE(price_currency, currency)`,
  },
  {
    // SkillUp trainer payouts: ServiceCredits paid to a trainer for validated mentorship work, recorded
    // as governed mint grants (reason 'levelup_trainer_split'). Always ServiceCredits (code 'SC').
    // Eligible service delivery only — excludes learner escrow returns, completion bonuses, stipends,
    // and microgrants. Read from governance events, not the SC ledger (whose entries are tagged
    // accounting_scope 'service_credits_non_gdp' by design).
    pluginSlug: 'skill-up',
    sql: `SELECT 'SC' AS currency_code, SUM(amount)::numeric AS total
            FROM service_credits_governance_events
            WHERE event_type = 'mint_grant' AND reason = 'levelup_trainer_split'`,
  },
  {
    // Foundation metered "Connect now" service calls: a caller pays a provider their locked rate per
    // minute-block for a 1:1 consultation. foundation_call_sessions snapshots the locked rate and the
    // paid-block count, so blocks_charged * rate_credits_locked is the total ServiceCredits ('SC') of
    // delivered call value. Read Foundation's own call record (not the SC ledger, which tags these
    // caller->provider moves accounting_scope 'service_credits_non_gdp'); only calls that charged a
    // block count. This is service delivered, not an incentive.
    pluginSlug: 'foundation',
    sql: `SELECT 'SC' AS currency_code, SUM(blocks_charged * rate_credits_locked)::numeric AS total
            FROM foundation_call_sessions
            WHERE blocks_charged > 0 AND rate_credits_locked IS NOT NULL`,
  },
  {
    // Direct ServiceCredits transfers: a member sending another member credits from the "Send Credits"
    // form — peer-to-peer activity NOT tied to a plugin transaction. Read the curated transfers record
    // for COMPLETED sends with origin_plugin 'service-credits'. Plugin-mediated transfers carry their own
    // origin_plugin and are attributed elsewhere, so there is no double count. Mints are not transfers.
    pluginSlug: 'service-credits',
    sql: `SELECT 'SC' AS currency_code, SUM(amount)::numeric AS total
            FROM service_credits_transfers
            WHERE status = 'completed' AND origin_plugin = 'service-credits'`,
  },
  {
    // Chyme peer tips: COMPLETED transfers with origin_plugin 'chyme'. Reads zero until the Chyme tip UI
    // is wired; registered now so tips count automatically once they flow.
    pluginSlug: 'chyme',
    sql: `SELECT 'SC' AS currency_code, SUM(amount)::numeric AS total
            FROM service_credits_transfers
            WHERE status = 'completed' AND origin_plugin = 'chyme'`,
  },
  {
    // LightHouse housing arrangements: a seeker asked to stay at a listed home and the host accepted.
    // Counted once per match in 'accepted' or 'completed' (one arrangement, two lifecycle states), worth
    // ONE month of the listed rent — the arrangement made here. Later months belong to Recurring
    // Activity, where the pair declares the ongoing relationship, so no month is counted twice and no
    // plugin holds a running rent total. A listing with no priced rent (0/NULL — the host form's "0 for
    // ServiceCredits / free") records no amount anywhere, so it counts as one FREE exchange rather than
    // an invented figure.
    pluginSlug: 'lighthouse',
    sql: `SELECT CASE WHEN p.monthly_rent > 0 AND p.rent_currency IS NOT NULL THEN p.rent_currency ELSE 'FREE' END AS currency_code,
                 SUM(CASE WHEN p.monthly_rent > 0 AND p.rent_currency IS NOT NULL THEN p.monthly_rent ELSE 1 END)::numeric AS total
            FROM lighthouse_matches m
            JOIN lighthouse_properties p ON p.id = m.property_id
            WHERE m.status IN ('accepted', 'completed')
            GROUP BY 1`,
  },
  {
    // SocketRelay favors: mutual aid, but a post may name an offered value (issue #120). Each
    // successfully-completed favor is recognized at its request's posted value — a priced post at
    // price_amount in price_currency, a post with no named value (or an amount-less type: Free, Barter)
    // as one FREE exchange by count. The standalone SocketRelay SC transfer route is intentionally not
    // also counted here to avoid double-counting a single favor. Mirrors socketRelayFavorSource in
    // packages/web/lib/gdp/recognition.ts.
    pluginSlug: 'socket-relay',
    sql: `SELECT COALESCE(r.price_currency, 'FREE') AS currency_code,
                 SUM(CASE WHEN r.price_amount IS NULL THEN 1 ELSE r.price_amount END)::numeric AS total
            FROM socket_relay_fulfillments f
            JOIN socket_relay_requests r ON r.id = f.request_id
            WHERE f.close_reason = 'successful'
            GROUP BY 1`,
  },
  {
    // Recurring Activity — fiat lines (issue #885): self-declared, counterparty-CONFIRMED ongoing peer
    // activities denominated in a fiat currency. Counted by NUMBER, one RACT each — never a fiat amount
    // (a fiat line stores no amount at all), so the platform never holds a recurring-fiat-payment total.
    // RACT is a hidden currencies row whose owner-curated weight (default 1) turns the count into the
    // index contribution. Only active (confirmed) rows count.
    pluginSlug: 'recurring-activity',
    sql: `SELECT 'RACT' AS currency_code, COUNT(*)::numeric AS total
            FROM recurring_activities
            WHERE status = 'active' AND currency_code <> 'SC'`,
  },
  {
    // Recurring Activity — ServiceCredits lines (issue #885): counted by their DECLARED sc_value,
    // scaled to a MONTHLY figure by the line's cadence so a weekly arrangement and a monthly one moving
    // the same credits over a year count the same (mirrors CADENCE_MONTHLY_FACTOR in
    // packages/web/lib/recurring-activity/types.ts — keep the two in step). ServiceCredits is an
    // internal credits unit with no third-party reporting duty. This is a declared figure, never an
    // executed transfer, so it never touches balances and never double-counts the direct ServiceCredits
    // transfer source (a different table). Only active (confirmed) rows count.
    pluginSlug: 'recurring-activity',
    sql: `SELECT 'SC' AS currency_code,
                 SUM(sc_value * (CASE cadence
                                   WHEN 'weekly' THEN 4.333333
                                   WHEN 'biweekly' THEN 2.166667
                                   WHEN 'monthly' THEN 1.000000
                                   WHEN 'quarterly' THEN 0.333333
                                   ELSE 1 END))::numeric AS total
            FROM recurring_activities
            WHERE status = 'active' AND currency_code = 'SC' AND sc_value IS NOT NULL`,
  },
  // Add more as approved. Keep eligible settled spend only — never incentives. A genuine peer-to-peer
  // transfer outside a plugin transaction is economic activity and is counted (service-credits above).
];

// Open, not-yet-closed posts that carry a value — the "what is still on the board" figure. Each query
// reads rows the recognition sources deliberately skip (open instead of settled), so a post is never
// in both figures at once. Mirrors PROJECTION_SOURCES in ctf/packages/web/lib/gdp/projection.ts.
export const PROJECTION_SOURCES = [
  {
    // TrustTransport open requests: live states only; priced types by price_amount, Free/Barter one
    // point per post. Completed requests are recognized via the earnings ledger, never here.
    pluginSlug: 'trust-transport',
    sql: `SELECT price_currency AS currency_code,
                 SUM(CASE WHEN price_amount IS NULL THEN 1 ELSE price_amount END)::numeric AS total
            FROM trust_transport_requests
            WHERE status IN ('open', 'accepted', 'in_progress')
              AND price_currency IS NOT NULL
            GROUP BY price_currency`,
  },
  {
    // Foundation quotes on the table: a provider has answered with a price and the survivor has not
    // closed it yet. A closed, settled quote is recognized for real, never here.
    pluginSlug: 'foundation',
    sql: `SELECT quoted_currency AS currency_code, SUM(quoted_amount)::numeric AS total
            FROM foundation_quote_requests
            WHERE lifecycle_state = 'provider_responded'
              AND quoted_amount IS NOT NULL AND quoted_currency IS NOT NULL
            GROUP BY quoted_currency`,
  },
  {
    // LightHouse homes still available: an active listing nobody has been accepted into yet, at ONE
    // month of the listed rent (the same unit recognition uses when a match is accepted). A listing
    // with an accepted/completed match is excluded — that home is recognized for real.
    pluginSlug: 'lighthouse',
    sql: `SELECT CASE WHEN p.monthly_rent > 0 AND p.rent_currency IS NOT NULL THEN p.rent_currency ELSE 'FREE' END AS currency_code,
                 SUM(CASE WHEN p.monthly_rent > 0 AND p.rent_currency IS NOT NULL THEN p.monthly_rent ELSE 1 END)::numeric AS total
            FROM lighthouse_properties p
            WHERE p.is_active = true
              AND NOT EXISTS (
                SELECT 1 FROM lighthouse_matches m
                 WHERE m.property_id = p.id AND m.status IN ('accepted', 'completed')
              )
            GROUP BY 1`,
  },
  {
    // SocketRelay favors waiting to be done: open or claimed, not past the 28-day expiry. A priced
    // post at its posted amount, a post with no named value (or Free/Barter) one point per post.
    pluginSlug: 'socket-relay',
    sql: `SELECT COALESCE(price_currency, 'FREE') AS currency_code,
                 SUM(CASE WHEN price_amount IS NULL THEN 1 ELSE price_amount END)::numeric AS total
            FROM socket_relay_requests
            WHERE status IN ('open', 'claimed')
              AND (expires_at IS NULL OR expires_at > NOW())
            GROUP BY 1`,
  },
  {
    // Recurring activities awaiting confirmation — fiat lines by count (one RACT each; a fiat line
    // stores no amount by design). Confirmed lines are recognized for real, never here.
    pluginSlug: 'recurring-activity',
    sql: `SELECT 'RACT' AS currency_code, COUNT(*)::numeric AS total
            FROM recurring_activities
            WHERE status = 'pending' AND currency_code <> 'SC'`,
  },
  {
    // Recurring activities awaiting confirmation — ServiceCredits lines by declared sc_value, scaled
    // to a monthly figure by cadence exactly as the confirmed source scales it, so a line contributes
    // the same before and after it is confirmed.
    pluginSlug: 'recurring-activity',
    sql: `SELECT 'SC' AS currency_code,
                 SUM(sc_value * (CASE cadence
                                   WHEN 'weekly' THEN 4.333333
                                   WHEN 'biweekly' THEN 2.166667
                                   WHEN 'monthly' THEN 1.000000
                                   WHEN 'quarterly' THEN 0.333333
                                   ELSE 1 END))::numeric AS total
            FROM recurring_activities
            WHERE status = 'pending' AND currency_code = 'SC' AND sc_value IS NOT NULL`,
  },
];

/**
 * Run a source list against a pg client and fold every (currency_code, total) row into one figure via
 * the contribution weights. A value type with no weight is collected in `unweighted` and excluded,
 * never silently treated as zero. Returns { valueIndex, unweighted } with valueIndex unrounded.
 */
export async function computeValueIndex(client, sources, weights = WEIGHTS) {
  let valueIndex = 0;
  const unweighted = new Set();
  for (const source of sources) {
    const res = await client.query(source.sql);
    for (const row of res.rows) {
      const code = row.currency_code;
      if (!code) continue;
      const amount = Number(row.total) || 0;
      const weight = weights.get(code);
      if (weight === undefined) {
        unweighted.add(code);
        continue;
      }
      valueIndex += amount * weight;
    }
  }
  return { valueIndex, unweighted };
}
