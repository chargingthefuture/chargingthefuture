
import { Pool } from 'pg';
import crypto from 'crypto';

const SEED_USER_IDS = [
  'user-00000001',
  'user-00000002',
  'user-00000003',
];

function deterministicTransferId(sender, recipient, amount) {
  return crypto.createHash('sha256').update(sender + recipient + amount.toString()).digest('hex').slice(0, 32);
}

function deterministicEntryId(userId, entryType, amount) {
  return crypto.createHash('sha256').update(userId + entryType + amount.toString()).digest('hex').slice(0, 32);
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
      // Seed wallets
      for (const userId of SEED_USER_IDS) {
        await client.query(
          `INSERT INTO service_credits_wallets (user_id, available_balance, escrow_balance)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId, 100, 0]
        );
      }

      // Seed transfers
      const transferId = deterministicTransferId(SEED_USER_IDS[0], SEED_USER_IDS[1], 25);
      await client.query(
        `INSERT INTO service_credits_transfers
         (id, sender_user_id, recipient_user_id, amount, status, idempotency_key, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          transferId,
          SEED_USER_IDS[0],
          SEED_USER_IDS[1],
          25,
          'completed',
          'transfer-' + SEED_USER_IDS[0] + '-' + SEED_USER_IDS[1],
        ]
      );

      // Seed ledger entries
      for (let i = 0; i < SEED_USER_IDS.length; i++) {
        const entryId = deterministicEntryId(SEED_USER_IDS[i], 'initial_allocation', 100);
        await client.query(
          `INSERT INTO service_credits_ledger_entries
           (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            entryId,
            SEED_USER_IDS[i],
            'initial_allocation',
            100,
            'bootstrap',
            'seed-allocation',
            'global',
            JSON.stringify({ reason: 'initial seed allocation' }),
          ]
        );
      }

      // Seed governance events
      const govEventId = crypto.createHash('sha256').update('governance-seed').digest('hex').slice(0, 32);
      await client.query(
        `INSERT INTO service_credits_governance_events (id, event_type, metadata)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [
          govEventId,
          'policy_update',
          JSON.stringify({ policy: 'standard-allocation', version: '1.0' }),
        ]
      );

      await client.query('COMMIT');
      console.log('Seeded ServiceCredits wallets, transfers, and ledger entries.');
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
