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

async function withDbTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const SEED_USER_IDS = [
  'user-00000001',
  'user-00000002',
  'user-00000003',
  'user-00000004',
];

const MOOD_SUBMISSIONS = [
  {
    user_id: SEED_USER_IDS[0],
    client_id: 'web-browser',
    mood_value: 4,
    note: 'Feeling good today',
  },
  {
    user_id: SEED_USER_IDS[1],
    client_id: 'mobile-ios',
    mood_value: 3,
    note: null,
  },
  {
    user_id: SEED_USER_IDS[2],
    client_id: 'web-browser',
    mood_value: 5,
    note: 'Great week',
  },
  {
    user_id: SEED_USER_IDS[3],
    client_id: 'mobile-android',
    mood_value: 2,
    note: 'Struggling',
  },
  {
    user_id: SEED_USER_IDS[0],
    client_id: 'mobile-ios',
    mood_value: 3,
    note: 'Average day',
  },
];

function deterministicId(user_id, client_id, mood_value, note) {
  return crypto.createHash('sha256').update(user_id + client_id + mood_value + (note || '')).digest('hex').slice(0, 32);
}

async function seed() {
  await withDbTransaction(async (client) => {
    for (const submission of MOOD_SUBMISSIONS) {
      const id = deterministicId(submission.user_id, submission.client_id, submission.mood_value, submission.note);
      await client.query(
        `INSERT INTO mood_submissions (id, user_id, client_id, mood_value, note, submitted_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, submission.user_id, submission.client_id, submission.mood_value, submission.note]
      );
    }
  });
  console.log('Seeded mood submissions.');
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
