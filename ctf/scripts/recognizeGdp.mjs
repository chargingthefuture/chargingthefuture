import { Pool } from 'pg';
import crypto from 'crypto';

// Community Value Index rollup (issue #121). Recognizes ACTUAL economic activity across the applicable
// plugins and folds every value type (fiat, crypto, ServiceCredits, barter, free) into ONE relative index via
// fixed, built-in contribution weights (WEIGHTS below; USD is the reference base = 1). Writes the
// `gdp_value_index` metric for the week — ALONGSIDE the projection target, not replacing it. A
// production scheduler runs this weekly.
//
// Starts with TrustTransport and LevelUp. Add more eligible-value sources to the SOURCES list below as
// the owner approves them, keeping it in step with ctf/packages/web/lib/gdp/recognition.ts (the app-side
// layer). Only eligible settled value is recognized — never transfers or deletion/reclaim reallocations.
//
// IMPORTANT: the Community Value Index is NOT money and carries no currency symbol. The contribution
// weights are never surfaced as a price, an exchange rate, or a per-wallet/per-token fiat equivalence.

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

// One per contributing plugin: a SQL query returning (currency_code, total) of eligible settled spend.
const SOURCES = [
  {
    pluginSlug: 'trust-transport',
    sql: `SELECT COALESCE(price_currency, currency) AS currency_code, SUM(amount)::numeric AS total
            FROM trust_transport_earnings_ledger
            WHERE entry_type IN ('credit', 'release')
            GROUP BY COALESCE(price_currency, currency)`,
  },
  {
    // LevelUp trainer payouts: ServiceCredits paid to a trainer for validated mentorship work, recorded
    // as governed mint grants (reason 'levelup_trainer_split'). Always ServiceCredits (code 'SC').
    // Eligible service delivery only — excludes learner escrow returns, completion bonuses, stipends,
    // and microgrants. Read from governance events, not the SC ledger (whose entries are tagged
    // accounting_scope 'service_credits_non_gdp' by design).
    pluginSlug: 'level-up',
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
    // SocketRelay favors: mutual aid with no per-favor price, so each successfully-completed favor counts
    // as one FREE exchange (by count). The standalone SocketRelay SC transfer route is intentionally not
    // also counted here to avoid double-counting a single favor.
    pluginSlug: 'socket-relay',
    sql: `SELECT 'FREE' AS currency_code, COUNT(*)::numeric AS total
            FROM socket_relay_fulfillments
            WHERE close_reason = 'successful'`,
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
    // Recurring Activity — ServiceCredits lines (issue #885): counted by their DECLARED sc_value.
    // ServiceCredits is an internal utility token with no third-party reporting duty. This is a declared
    // figure, never an executed transfer, so it never touches balances and never double-counts the
    // direct ServiceCredits transfer source (a different table). Only active (confirmed) rows count.
    pluginSlug: 'recurring-activity',
    sql: `SELECT 'SC' AS currency_code, SUM(sc_value)::numeric AS total
            FROM recurring_activities
            WHERE status = 'active' AND currency_code = 'SC' AND sc_value IS NOT NULL`,
  },
  // Add more as approved. Keep eligible settled spend only — never incentives. A genuine peer-to-peer
  // transfer outside a plugin transaction is economic activity and is counted (service-credits above).
];

// Fixed, built-in contribution weights — mirror ctf/packages/web/lib/gdp/recognition.ts
// (DEFAULT_CONTRIBUTION_WEIGHTS). There is no database or admin step, so the index is always live and
// needs no owner action. ServiceCredits is the native unit and counts 1:1; each completed non-money
// exchange (FREE favor, BARTER trade) counts one point; foreign-currency settled value normalizes to a
// USD reference. RACT (recurring activity, a by-count code produced only by this weekly rollup) counts one
// point per confirmed line. Notional index weights only — never a price, exchange rate, or redemption value.
const WEIGHTS = new Map([
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

function currentWeekStartIso() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const backToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + backToMonday));
  return monday.toISOString().slice(0, 10);
}

const WEEK_START = process.env.GDP_RECOGNITION_WEEK_START || currentWeekStartIso();

async function run() {
  const pool = new Pool({
    connectionString: requireEnv('DATABASE_URL'),
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    // Community Value Index: fold EVERY value type (fiat, crypto, ServiceCredits, barter, free) into one
    // relative figure via its fixed, built-in contribution weight (WEIGHTS). The index is NOT money and
    // carries no currency symbol; the weights (USD is the reference base = 1) are never a price or
    // redemption rate. A value type with no built-in weight is surfaced and excluded, never silently zeroed.
    let valueIndex = 0;
    const unweighted = new Set();
    for (const source of SOURCES) {
      const res = await client.query(source.sql);
      for (const row of res.rows) {
        const code = row.currency_code;
        if (!code) continue;
        const amount = Number(row.total) || 0;
        const weight = WEIGHTS.get(code);
        if (weight === undefined) {
          unweighted.add(code);
          continue;
        }
        valueIndex += amount * weight;
      }
    }

    const metricId = crypto
      .createHash('sha256')
      .update(`${WEEK_START}gdp_value_indexgdp`)
      .digest('hex')
      .slice(0, 32);
    const recognizedIndex = Math.round(valueIndex);
    await client.query(
      `INSERT INTO gdp_metric_snapshots
         (id, week_start_date, metric_key, metric_value, dp_suppressed, lawful_basis, source_plugin, is_estimate)
       VALUES ($1, $2, 'gdp_value_index', $3, false, 'service-delivery', 'gdp', true)
       ON CONFLICT (id) DO UPDATE SET metric_value = EXCLUDED.metric_value, is_estimate = EXCLUDED.is_estimate`,
      [metricId, WEEK_START, recognizedIndex],
    );

    if (unweighted.size > 0) {
      console.warn(`Excluded value types with no active contribution weight: ${[...unweighted].join(', ')}`);
    }
    console.log(`Community Value Index for week ${WEEK_START}: ${recognizedIndex}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
