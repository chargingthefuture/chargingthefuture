#!/usr/bin/env node

// Workforce seed.
//
// Workforce is a read-only live tracker: demand comes from Skills Taxonomy
// (sectors + workforce_share), supply comes from Directory (profiles, claimed =
// recruited). Neither of those is seeded here — they are owned by their own
// plugins. The only workforce-owned state is the config singleton (the
// population model), so that is all this seed writes.
import { Pool } from 'pg';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

const pool = new Pool({
  connectionString: requireEnv('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
});

// Baseline modeled on a thriving population of ~5,000,000 survivors (researched
// against economies the size of Finland / Singapore), with a 0.5 workforce
// participation rate.
const WORKFORCE_CONFIG = {
  population: 5_000_000,
  participationRate: 0.5,
  minRecruitable: 2_000_000,
  maxRecruitable: 5_000_000,
};

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `
        INSERT INTO workforce_config
          (singleton_key, population, participation_rate, min_recruitable, max_recruitable, updated_by_user_id)
        VALUES
          (true, $1, $2, $3, $4, 'seed-admin')
        ON CONFLICT (singleton_key)
        DO UPDATE SET
          population = EXCLUDED.population,
          participation_rate = EXCLUDED.participation_rate,
          min_recruitable = EXCLUDED.min_recruitable,
          max_recruitable = EXCLUDED.max_recruitable,
          updated_by_user_id = 'seed-admin',
          updated_at = NOW()
      `,
      [
        WORKFORCE_CONFIG.population,
        WORKFORCE_CONFIG.participationRate,
        WORKFORCE_CONFIG.minRecruitable,
        WORKFORCE_CONFIG.maxRecruitable,
      ],
    );

    await client.query('COMMIT');
    console.log('Workforce config seed applied.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
