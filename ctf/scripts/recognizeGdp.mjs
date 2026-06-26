import { Pool } from 'pg';
import crypto from 'crypto';

// Community Value Index rollup (issue #121). Recognizes actual economic activity across applicable
// plugins and folds every value type (fiat, crypto, ServiceCredits, barter, free) into one relative
// index via owner-set contribution weights (currency_usd_rates; USD is only the reference base = 1).
// Writes the `gdp_value_index` metric for the week alongside the projection target, not replacing it.
// A production scheduler runs this weekly.
//
// Keep this source list in step with ctf/packages/web/lib/gdp/recognition.ts. Only eligible settled
// value is recognized, never incentives, transfers, or deletion/reclaim reallocations.
//
// IMPORTANT: the Community Value Index is not money and carries no currency symbol. Contribution
// weights are never surfaced as a price, exchange rate, or per-wallet/per-token fiat equivalence.

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
    // LevelUp trainer payouts: ServiceCredits paid to a trainer for validated mentorship work,
    // recorded as governed mint grants. Eligible service delivery only; excludes learner escrow
    // returns, completion bonuses, stipends, and microgrants.
    pluginSlug: 'level-up',
    sql: `SELECT 'SC' AS currency_code, SUM(amount)::numeric AS total
            FROM service_credits_governance_events
            WHERE event_type = 'mint_grant' AND reason = 'levelup_trainer_split'`,
  },
  {
    // Foundation metered "Connect now" service calls: a caller pays a provider their locked rate per
    // minute-block for a 1:1 consultation. Only calls that charged at least one block count.
    pluginSlug: 'foundation',
    sql: `SELECT 'SC' AS currency_code, SUM(blocks_charged * rate_credits_locked)::numeric AS total
            FROM foundation_call_sessions
            WHERE blocks_charged > 0 AND rate_credits_locked IS NOT NULL`,
  },
  {
    // Direct ServiceCredits transfers: a member sending another member credits from the "Send Credits"
    // form, not tied to a plugin transaction.
    pluginSlug: 'service-credits',
    sql: `SELECT 'SC' AS currency_code, SUM(amount)::numeric AS total
            FROM service_credits_transfers
            WHERE status = 'completed' AND origin_plugin = 'service-credits'`,
  },
  {
    // Chyme peer tips: completed transfers with origin_plugin 'chyme'. Reads zero until the tip UI is
    // wired; registered now so tips count automatically once they flow.
    pluginSlug: 'chyme',
    sql: `SELECT 'SC' AS currency_code, SUM(amount)::numeric AS total
            FROM service_credits_transfers
            WHERE status = 'completed' AND origin_plugin = 'chyme'`,
  },
  {
    // SocketRelay favors: mutual aid with no per-favor price, so each successfully completed favor
    // counts as one FREE exchange by count.
    pluginSlug: 'socket-relay',
    sql: `SELECT 'FREE' AS currency_code, COUNT(*)::numeric AS total
            FROM socket_relay_fulfillments
            WHERE close_reason = 'successful'`,
  },
  {
    // LightHouse rent: only completed matches with an explicit on-platform settlement record count.
    // Property monthly_rent is only a listing price and is never recognized by itself. Priced value
    // types sum settlement_amount; amount-less types such as Free/Barter count one exchange each.
    pluginSlug: 'lighthouse',
    sql: `SELECT lm.settlement_currency AS currency_code,
                 SUM(CASE WHEN c.requires_amount THEN lm.settlement_amount ELSE 1 END)::numeric AS total
            FROM lighthouse_matches lm
            JOIN currencies c ON c.code = lm.settlement_currency
            WHERE lm.status = 'completed'
              AND lm.settled_at IS NOT NULL
              AND (
                (c.requires_amount = TRUE AND lm.settlement_amount > 0)
                OR c.requires_amount = FALSE
              )
            GROUP BY lm.settlement_currency`,
  },
  // Add more as approved. Keep eligible settled spend only, never incentives.
];

function currentWeekStartIso() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
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
    const ratesResult = await client.query(
      `SELECT DISTINCT ON (currency_code) currency_code, usd_rate
         FROM currency_usd_rates
         ORDER BY currency_code, as_of DESC`,
    );
    const rates = new Map(ratesResult.rows.map((row) => [row.currency_code, Number(row.usd_rate)]));

    let valueIndex = 0;
    const unweighted = new Set();
    for (const source of SOURCES) {
      const res = await client.query(source.sql);
      for (const row of res.rows) {
        const code = row.currency_code;
        if (!code) continue;
        const amount = Number(row.total) || 0;
        const weight = rates.get(code);
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
