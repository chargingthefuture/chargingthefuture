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

const WINDOW_DAYS = 7;
const DAY_MS = 86400000;

// Midnight UTC today, the anchor for the open event. While a survey is open the times on offer roll
// forward from the current moment, so seeded votes must sit ahead of now or they count for nothing —
// they are placed on the days after this one. The closed event keeps a fixed past date: it is history,
// its winner is already stamped, and a fixed date keeps that half of the seed reproducible.
const TODAY_START = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime();
const OPEN_WINDOW_START = new Date(TODAY_START).toISOString().slice(0, 10);
const CLOSED_WINDOW_START = '2026-07-21';

// Build a candidate slot ISO from a window anchor, a day offset, and a UTC time-of-day (half-hour
// aligned).
function slotFrom(baseMs, dayOffset, hourUtc, minute = 0) {
  return new Date(baseMs + dayOffset * DAY_MS + hourUtc * 3600000 + minute * 60000).toISOString();
}

// Open-event slots: day offset 1 upward, so every seeded pick is still ahead of now whenever the seed
// runs, and every one of them falls inside the rolling seven-day window.
function slot(dayOffset, hourUtc, minute = 0) {
  return slotFrom(TODAY_START, dayOffset + 1, hourUtc, minute);
}

// Closed-event slots: the fixed historical window.
function closedSlot(dayOffset, hourUtc, minute = 0) {
  return slotFrom(Date.parse(`${CLOSED_WINDOW_START}T00:00:00.000Z`), dayOffset, hourUtc, minute);
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

// Closed event: winner is closedSlot(1, 17, 0), which 4 of 5 voters picked.
const CLOSED_EVENT = {
  slug: 'q3-onboarding-seed',
  title: 'Q3 onboarding',
  description: 'Kickoff for the new cohort.',
  meetingPlugin: 'peer-programming',
  resultSlot: closedSlot(1, 17, 0),
  resultCanMakeIt: 4,
  votes: [
    [VOTERS[0], [closedSlot(1, 17, 0)]],
    [VOTERS[1], [closedSlot(1, 17, 0), closedSlot(3, 20, 0)]],
    [VOTERS[2], [closedSlot(1, 17, 0)]],
    [VOTERS[3], [closedSlot(1, 17, 0)]],
    [VOTERS[4], [closedSlot(3, 20, 0)]],
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
      closed ? CLOSED_WINDOW_START : OPEN_WINDOW_START,
      WINDOW_DAYS,
      closed ? 'closed' : 'open',
      closed ? ev.resultSlot : null,
      closed ? ev.resultCanMakeIt : null,
      closed ? new Date().toISOString() : null,
    ],
  );
  // Re-running the seed on a later day would otherwise leave the earlier run's votes behind as picks
  // whose time has gone by, so the open event's votes are replaced each run. The closed event's votes
  // are historical evidence for a stamped result — they are left alone.
  if (!closed) {
    await client.query(`DELETE FROM mutual_time_votes WHERE event_id = $1`, [eventId]);
  }
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
