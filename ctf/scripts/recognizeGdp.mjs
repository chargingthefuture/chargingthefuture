import { Pool } from 'pg';
import crypto from 'crypto';
import { RECOGNITION_SOURCES, WEIGHTS, computeValueIndex } from './lib/gdpValueIndex.mjs';

// Community Value Index rollup (issue #121). Recognizes ACTUAL economic activity across the applicable
// plugins and folds every value type (fiat, crypto, ServiceCredits, barter, free) into ONE relative index via
// fixed, built-in contribution weights (USD is the reference base = 1). Writes the
// `gdp_value_index` metric for the week — ALONGSIDE the projection target, not replacing it. A
// production scheduler runs this weekly.
//
// The source list and the weights live in ./lib/gdpValueIndex.mjs, shared with the weekly
// community-stats draft (generate-community-stats.mjs) so the two scripts can never drift apart. Add
// more eligible-value sources there as the owner approves them, keeping it in step with
// ctf/packages/web/lib/gdp/recognition.ts (the app-side layer). Only eligible settled value is
// recognized — never transfers or deletion/reclaim reallocations.
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
    const { valueIndex, unweighted } = await computeValueIndex(client, RECOGNITION_SOURCES, WEIGHTS);

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
