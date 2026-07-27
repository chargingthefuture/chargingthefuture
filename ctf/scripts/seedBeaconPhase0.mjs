#!/usr/bin/env node

// Seeds one past, ended Beacon event with a recording URL so the viewer's idle/replay state and the
// admin history list render with real data in demos. Deterministic UUIDs keep re-runs idempotent.
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

// Deterministic UUID v4-shaped id from a stable seed string.
function deterministicUuid(input) {
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}

const HOST_USER_ID = 'user-00000001';
const EVENT_ID = deterministicUuid('beacon-event-state-of-the-ti-skills-economy-2026-05-30');
const RECORDING_URL = 'https://stream-recordings.example/beacon/state-of-the-ti-skills-economy-2026-05-30.m3u8';

async function seed() {
  await queryDb('BEGIN');
  try {
    await queryDb(
      `INSERT INTO beacon_events
         (id, title, description, status, host_user_id, stream_call_type, stream_call_id,
          started_at, ended_at, recording_url, recording_ready_at)
       VALUES
         ($1, $2, $3, 'ended', $4, 'livestream', $5,
          NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days' + INTERVAL '38 minutes',
          $6, NOW() - INTERVAL '22 days' + INTERVAL '50 minutes')
       ON CONFLICT (id) DO NOTHING`,
      [
        EVENT_ID,
        'State of the Skills Economy',
        'A live walkthrough of where the survivor skills economy stands and what is shipping next.',
        HOST_USER_ID,
        `beacon-${EVENT_ID}`,
        RECORDING_URL,
      ],
    );

    await queryDb(
      `INSERT INTO beacon_events_admin_audit_trail
         (id, actor_id, command, policy_status, reason, target_type, target_id, metadata)
       VALUES ($1, $2, 'beacon.event.create', 'allow', 'seed', 'event', $3, '{}'::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [deterministicUuid(`beacon-audit-${EVENT_ID}`), HOST_USER_ID, EVENT_ID],
    );

    await queryDb('COMMIT');
    console.log(`Seeded Beacon event ${EVENT_ID} (ended, with recording).`);
  } catch (error) {
    await queryDb('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  console.error('seedBeaconPhase0 failed:', error.message);
  process.exitCode = 1;
});
