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
  { key: 'users.active', value: 1250, source: 'directory' },
  { key: 'posts.created', value: 342, source: 'feed' },
  { key: 'connections.initiated', value: 89, source: 'foundation' },
  { key: 'skills.matched', value: 156, source: 'skills-hunt' },
  { key: 'workforce.placements', value: 23, source: 'workforce' },
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
         (id, week_start_date, metric_key, metric_value, dp_suppressed, lawful_basis, source_plugin)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          id,
          WEEK_START,
          metric.key,
          metric.value,
          false,
          'service-delivery',
          metric.source,
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
