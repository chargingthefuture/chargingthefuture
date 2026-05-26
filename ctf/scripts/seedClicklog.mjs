
import { queryDb } from '../packages/web/lib/db/postgres.ts';
import crypto from 'crypto';

const SEED_USER_IDS = [
  'user-00000001',
  'user-00000002',
  'user-00000003',
];

const INCIDENTS = [
  {
    user_id: SEED_USER_IDS[0],
    metadata: { latitude: 37.7749, longitude: -122.4194, notes: 'Test incident with location and notes' },
  },
  {
    user_id: SEED_USER_IDS[1],
    metadata: { latitude: 40.7128, longitude: -74.0060 },
  },
  {
    user_id: SEED_USER_IDS[2],
    metadata: { notes: 'Incident with notes only' },
  },
  {
    user_id: SEED_USER_IDS[0],
    metadata: {},
  },
  {
    user_id: SEED_USER_IDS[1],
    metadata: { latitude: 51.5074, longitude: -0.1278, notes: 'London incident' },
  },
];


function deterministicId(user_id, metadata) {
  return crypto.createHash('sha256').update(user_id + JSON.stringify(metadata)).digest('hex').slice(0, 32);
}

async function seed() {
  await queryDb('BEGIN');
  try {
    for (const incident of INCIDENTS) {
      const id = deterministicId(incident.user_id, incident.metadata);
      await queryDb(
        `INSERT INTO clicklog_incidents (id, user_id, metadata, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, incident.user_id, JSON.stringify(incident.metadata)]
      );
    }
    await queryDb('COMMIT');
    console.log('Seeded clicklog incidents.');
  } catch (err) {
    try {
      await queryDb('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    throw err;
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
