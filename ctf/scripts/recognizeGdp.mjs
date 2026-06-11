import { Pool } from 'pg';
import crypto from 'crypto';

// GDP recognition rollup (issue #121). Recognizes ACTUAL multi-currency transaction volume across the
// applicable plugins, normalizes it to one USD estimate via currency_usd_rates, and writes the
// `gdp_recognized_volume_usd` metric (is_estimate = TRUE) for the week — ALONGSIDE the projection
// target, not replacing it. A production scheduler runs this weekly.
//
// Starts with TrustTransport. Add more eligible-spend sources to the SOURCES list below as the owner
// approves them, keeping it in step with ctf/packages/web/lib/gdp/recognition.ts (the app-side layer).
// Only eligible settled spend is recognized — never transfers or deletion/reclaim reallocations.
//
// LEGAL GUARDRAIL: the currency_usd_rates factors (including ServiceCredits) are applied ONLY here,
// inside the aggregate estimate — never surfaced as a per-wallet or per-price fiat equivalence.

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
  // Add more as approved. Keep eligible settled spend only.
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

    // ServiceCredits ('SC') is a non-redeemable utility token and is NEVER converted to USD. Its
    // recognized volume is summed separately in SC units and written as its own metric, shown alongside
    // the USD figure. Convertible (fiat/crypto) volume is normalized to USD via the active rates.
    const SERVICE_CREDITS_CODE = 'SC';
    let usdEstimate = 0;
    let serviceCreditsVolume = 0;
    const unrated = new Set();
    for (const source of SOURCES) {
      const res = await client.query(source.sql);
      for (const row of res.rows) {
        const code = row.currency_code;
        if (!code) continue;
        const amount = Number(row.total) || 0;
        if (code === SERVICE_CREDITS_CODE) {
          serviceCreditsVolume += amount;
          continue;
        }
        const rate = rates.get(code);
        if (rate === undefined) {
          unrated.add(code);
          continue;
        }
        usdEstimate += amount * rate;
      }
    }

    const metricIdFor = (metricKey) =>
      crypto.createHash('sha256').update(`${WEEK_START}${metricKey}gdp`).digest('hex').slice(0, 32);

    const recognizedUsd = Math.round(usdEstimate);
    await client.query(
      `INSERT INTO gdp_metric_snapshots
         (id, week_start_date, metric_key, metric_value, dp_suppressed, lawful_basis, source_plugin, is_estimate)
       VALUES ($1, $2, 'gdp_recognized_volume_usd', $3, false, 'service-delivery', 'gdp', true)
       ON CONFLICT (id) DO UPDATE SET metric_value = EXCLUDED.metric_value, is_estimate = EXCLUDED.is_estimate`,
      [metricIdFor('gdp_recognized_volume_usd'), WEEK_START, recognizedUsd],
    );

    // ServiceCredits volume is an exact count of SC, not a normalized estimate → is_estimate = false.
    const recognizedSc = Math.round(serviceCreditsVolume);
    await client.query(
      `INSERT INTO gdp_metric_snapshots
         (id, week_start_date, metric_key, metric_value, dp_suppressed, lawful_basis, source_plugin, is_estimate)
       VALUES ($1, $2, 'gdp_recognized_volume_sc', $3, false, 'service-delivery', 'gdp', false)
       ON CONFLICT (id) DO UPDATE SET metric_value = EXCLUDED.metric_value, is_estimate = EXCLUDED.is_estimate`,
      [metricIdFor('gdp_recognized_volume_sc'), WEEK_START, recognizedSc],
    );

    if (unrated.size > 0) {
      console.warn(`Excluded currencies with no active rate: ${[...unrated].join(', ')}`);
    }
    console.log(
      `Recognized for week ${WEEK_START}: USD estimate ${recognizedUsd}, ServiceCredits volume ${recognizedSc} SC`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
