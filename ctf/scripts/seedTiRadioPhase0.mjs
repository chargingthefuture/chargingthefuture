#!/usr/bin/env node

// TI Radio seed — three booked slots on the week ahead, so the guide has something to render
// locally instead of seven days of empty rows.
//
// The times are computed from the current 90-minute grid rather than hard-coded, because a fixed
// timestamp falls out of the guide's rolling week within days and the seed then appears to do
// nothing. The slot ids are deterministic, so re-running replaces the same three rows instead of
// filling the schedule up.
//
// What it deliberately does NOT seed: a released or removed slot. Both are one press to create
// while testing, and a seeded removal would put a moderation decision in front of a reviewer that
// nobody actually made.

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

const SLOT_MS = 90 * 60 * 1000;

// Deterministic UUIDs (hex only) so ON CONFLICT (id) DO UPDATE keeps re-runs idempotent.
const slots = [
  {
    id: '71rad10a-0000-4000-8000-000000000001',
    hostUserId: 'seed-ti-radio-host-001',
    hostUsername: 'seed_host_one',
    title: 'Sleep, noise, and getting through the night',
    description: 'What has actually helped, and what has not. Bring your own.',
    // Slots ahead of now, on the grid: the next one, one a day out, one three days out.
    slotsAhead: 2,
  },
  {
    id: '71rad10a-0000-4000-8000-000000000002',
    hostUserId: 'seed-ti-radio-host-002',
    hostUsername: 'seed_host_two',
    title: 'Reading a police report without spiraling',
    description: null,
    slotsAhead: 16,
  },
  {
    id: '71rad10a-0000-4000-8000-000000000003',
    hostUserId: 'seed-ti-radio-host-001',
    hostUsername: 'seed_host_one',
    title: 'Open hour: bring anything',
    description: 'No subject. Whoever turns up sets it.',
    slotsAhead: 48,
  },
];

function slotStartFor(slotsAhead) {
  const nextStart = Math.ceil(Date.now() / SLOT_MS) * SLOT_MS;
  return new Date(nextStart + slotsAhead * SLOT_MS).toISOString();
}

async function seed() {
  for (const slot of slots) {
    await pool.query(
      `INSERT INTO ti_radio_slots (id, slot_start_utc, host_user_id, host_username, title, description, status)
       VALUES ($1::uuid, $2::timestamptz, $3, $4, $5, $6, 'booked')
       ON CONFLICT (id) DO UPDATE
         SET slot_start_utc = EXCLUDED.slot_start_utc,
             host_user_id = EXCLUDED.host_user_id,
             host_username = EXCLUDED.host_username,
             title = EXCLUDED.title,
             description = EXCLUDED.description,
             status = 'booked',
             released_at = NULL,
             removed_by = NULL,
             removed_at = NULL,
             removal_reason = NULL,
             updated_at = NOW()`,
      [slot.id, slotStartFor(slot.slotsAhead), slot.hostUserId, slot.hostUsername, slot.title, slot.description],
    );
  }

  console.info(`[seed:ti-radio] ${slots.length} slots booked on the week ahead.`);
}

seed()
  .catch((error) => {
    console.error('[seed:ti-radio] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
