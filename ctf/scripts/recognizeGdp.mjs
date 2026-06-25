import { Pool } from 'pg';
import crypto from 'crypto';

// Community Value Index rollup (issue #121). Recognizes ACTUAL economic activity across the applicable
// plugins and folds every value type (fiat, crypto, ServiceCredits, barter, free) into ONE relative index via
// owner-set contribution weights (currency_usd_rates; USD is the reference base = 1). Writes the
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
    pluginSlug: 'trusttransport',
    sql: `SELECT COALESCE(price_currency, currency) AS currency_code, SUM(amount)::numeric AS total
            FROM trusttransport_earnings_ledger
            WHERE entry_type IN ('credit', 'release')
            GROUP BY COALESCE(price_currency, currency)`,
  },
  {
    // LevelUp trainer payouts: ServiceCredits paid to a trainer for validated mentorship work, recorded
    // as governed mint grants (reason 'levelup_trainer_split'). Always ServiceCredits (code 'SC').
    // Eligible service delivery only — excludes learner escrow returns, completion bonuses, stipends,
    // and microgrants. Read from governance events, not the SC ledger (whose entries are tagged
    // accounting_scope 'service_credits_non_gdp' by design).
    pluginSlug: 'levelup',
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
  // Add more as approved. Keep eligible settled spend only — never incentives or plain transfers.
];

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
    const ratesResult = await client.query(
      `SELECT DISTINCT ON (currency_code) currency_code, usd_rate
         FROM currency_usd_rates
         ORDER BY currency_code, as_of DESC`,
    );
    const rates = new Map(ratesResult.rows.map((row) => [row.currency_code, Number(row.usd_rate)]));

    // Community Value Index: fold EVERY value type (fiat, crypto, ServiceCredits, barter, free) into one
    // relative figure via its owner-set contribution weight. The index is NOT money and carries no
    // currency symbol; the weights (here USD is the reference base = 1) are never a price or redemption
    // rate. A value type with no active weight is surfaced and excluded, never silently zeroed.
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
