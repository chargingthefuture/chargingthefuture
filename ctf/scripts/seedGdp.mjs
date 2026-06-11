#!/usr/bin/env node

import { Pool } from 'pg';
import crypto from 'crypto';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

const pool = new Pool({
  connectionString: requireEnv('DATABASE_URL'),
  ssl: {
    rejectUnauthorized: false,
  },
});

async function queryDb(text, values = []) {
  return pool.query(text, values);
}

const WEEK_START = '2026-05-19';

const METRICS = [
  { key: 'users.active', value: 1250, source: 'directory', isEstimate: false },
  { key: 'posts.created', value: 342, source: 'feed', isEstimate: false },
  { key: 'connections.initiated', value: 89, source: 'foundation', isEstimate: false },
  { key: 'skills.matched', value: 156, source: 'skills-hunt', isEstimate: false },
  { key: 'workforce.placements', value: 23, source: 'workforce', isEstimate: false },
  // The USD-normalized GDP total (issue #121): one estimate rolled from multi-currency transaction
  // volume via currency_usd_rates in the GDP estimation layer. isEstimate = true so the UI can label
  // it an estimate. The value here is a deterministic placeholder the owner/recognition layer revises.
  { key: 'gdp_total_revenue', value: 12500, source: 'gdp', isEstimate: true },
  // ServiceCredits-denominated recognized service activity (issue #121 follow-up): an exact SC count
  // (not a USD estimate, never converted to fiat), shown alongside the USD GDP. The recognition job
  // (pnpm gdp:recognize) revises this from real LevelUp trainer payouts; this seeds a demo value.
  { key: 'gdp_recognized_volume_sc', value: 8400, source: 'gdp', isEstimate: false },
];

function deterministicId(weekDate, metricKey, sourcePlugin) {
  return crypto.createHash('sha256').update(weekDate + metricKey + sourcePlugin).digest('hex').slice(0, 32);
}

async function seed() {
  await queryDb('BEGIN');
  try {
    for (const metric of METRICS) {
      const id = deterministicId(WEEK_START, metric.key, metric.source);
      await queryDb(
        `INSERT INTO gdp_metric_snapshots
         (id, week_start_date, metric_key, metric_value, dp_suppressed, lawful_basis, source_plugin, is_estimate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           week_start_date = EXCLUDED.week_start_date,
           metric_key = EXCLUDED.metric_key,
           metric_value = EXCLUDED.metric_value,
           dp_suppressed = EXCLUDED.dp_suppressed,
           lawful_basis = EXCLUDED.lawful_basis,
           source_plugin = EXCLUDED.source_plugin,
           is_estimate = EXCLUDED.is_estimate`,
        [
          id,
          WEEK_START,
          metric.key,
          metric.value,
          false,
          'service-delivery',
          metric.source,
          metric.isEstimate,
        ]
      );
    }
    await queryDb('COMMIT');
    console.log('Seeded GDP metric snapshots.');
  } catch (err) {
    try {
      await queryDb('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    throw err;
  }
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
