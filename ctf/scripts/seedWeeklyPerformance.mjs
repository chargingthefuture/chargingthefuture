
import { Pool } from 'pg';
import crypto from 'crypto';

const WEEK_START = '2026-05-19';

// Only the week row is seeded: every weekly number is computed live from the other plugins' rows
// on each read, so there is no metric store to fill.

function deterministicWeekId(weekDate) {
  return crypto.createHash('sha256').update('week-' + weekDate).digest('hex').slice(0, 32);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function seed() {
  const pool = new Pool({
    connectionString: requireEnv('DATABASE_URL'),
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      // Seed week record
      const weekId = deterministicWeekId(WEEK_START);
      await client.query(
        `INSERT INTO weekly_performance_weeks (id, week_start_date, summary)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [
          weekId,
          WEEK_START,
          'Week ending ' + WEEK_START + ': strong engagement and retention metrics',
        ]
      );

      await client.query('COMMIT');
      console.log('Seeded weekly performance weeks.');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
