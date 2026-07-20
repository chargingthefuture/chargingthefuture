#!/usr/bin/env node

import { Pool } from 'pg';
import crypto from 'crypto';

// Deterministic, idempotent seed for Mutual Time (spec #1780). Creates two sample events so a fresh DB
// renders a realistic dashboard + a shareable link in each state:
//   1. an OPEN survey ("Weekly check-in") with a spread of votes, no close date (manual close), and
//   2. a CLOSED survey ("Q3 onboarding") with a computed winning time.
// Uses a self-contained pg Pool + one transaction (the canonical seed pattern), so it loads under plain
// `node`. Re-runnable: fixed slugs + ON CONFLICT DO NOTHING make every statement idempotent.

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

function det(label) {
  const hex = crypto.createHash('sha256').update(label).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const SEED_ADMIN = 'mutual-time-seed-admin';
const VOTERS = [
  'mutual-time-seed-voter-001',
  'mutual-time-seed-voter-002',
  'mutual-time-seed-voter-003',
  'mutual-time-seed-voter-004',
  'mutual-time-seed-voter-005',
];

// Fixed candidate window so the seed is deterministic (window_start_date + i*30min, one-hour windows).
const WINDOW_START = '2026-07-21';
const WINDOW_DAYS = 7;

// Build a candidate slot ISO from a day offset and a UTC time-of-day (half-hour aligned).
function slot(dayOffset, hourUtc, minute = 0) {
  const base = Date.parse(`${WINDOW_START}T00:00:00.000Z`);
  return new Date(base + dayOffset * 86400000 + hourUtc * 3600000 + minute * 60000).toISOString();
}

// Open event: votes cluster so overlap is visible but no winner is stored until it is closed.
const OPEN_EVENT = {
  slug: 'weekly-check-in-seed',
  title: 'Weekly check-in',
  description: 'When works for everyone this week?',
  meetingPlugin: 'chyme',
  votes: [
    [VOTERS[0], [slot(0, 18, 0), slot(1, 18, 0)]],
    [VOTERS[1], [slot(0, 18, 0), slot(2, 19, 30)]],
    [VOTERS[2], [slot(0, 18, 0)]],
    [VOTERS[3], [slot(1, 18, 0), slot(0, 18, 0)]],
    [VOTERS[4], [slot(2, 19, 30)]],
  ],
};

// Closed event: winner is slot(1, 17, 0), which 4 of 5 voters picked.
const CLOSED_EVENT = {
  slug: 'q3-onboarding-seed',
  title: 'Q3 onboarding',
  description: 'Kickoff for the new cohort.',
  meetingPlugin: 'peer-programming',
  resultSlot: slot(1, 17, 0),
  resultCanMakeIt: 4,
  votes: [
    [VOTERS[0], [slot(1, 17, 0)]],
    [VOTERS[1], [slot(1, 17, 0), slot(3, 20, 0)]],
    [VOTERS[2], [slot(1, 17, 0)]],
    [VOTERS[3], [slot(1, 17, 0)]],
    [VOTERS[4], [slot(3, 20, 0)]],
  ],
};

async function seedEvent(client, ev, closed) {
  const eventId = det(`mutual-time-event:${ev.slug}`);
  await client.query(
    `
      INSERT INTO mutual_time_events (
        id, slug, created_by_user_id, title, description, meeting_plugin,
        window_start_date, window_days, opens_at, closes_at, status,
        result_slot_start, result_can_make_it, closed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, NULL, $9, $10, $11, $12)
      ON CONFLICT (slug) DO NOTHING
    `,
    [
      eventId,
      ev.slug,
      SEED_ADMIN,
      ev.title,
      ev.description,
      ev.meetingPlugin,
      WINDOW_START,
      WINDOW_DAYS,
      closed ? 'closed' : 'open',
      closed ? ev.resultSlot : null,
      closed ? ev.resultCanMakeIt : null,
      closed ? new Date().toISOString() : null,
    ],
  );
  for (const [voter, slots] of ev.votes) {
    for (const iso of slots) {
      await client.query(
        `
          INSERT INTO mutual_time_votes (id, event_id, voter_user_id, slot_start_utc)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (event_id, voter_user_id, slot_start_utc) DO NOTHING
        `,
        [det(`mutual-time-vote:${ev.slug}:${voter}:${iso}`), eventId, voter, iso],
      );
    }
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seedEvent(client, OPEN_EVENT, false);
    await seedEvent(client, CLOSED_EVENT, true);
    await client.query('COMMIT');
    console.info('[seed:mutual-time] Seeded 2 events (1 open, 1 closed) with sample votes.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[seed:mutual-time] Failed:', error);
  process.exitCode = 1;
});
