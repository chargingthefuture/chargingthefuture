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

const SEED_USER_IDS = [
  'user-00000001',
  'user-00000002',
  'user-00000003',
  'user-00000004',
  'user-00000005',
];

const WEEK_START = '2026-05-19';

function deterministicUuid(input) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
}

async function seed() {
  await queryDb('BEGIN');
  try {
    // Seed weekly topics
    const topicId = deterministicUuid('topic-week-' + WEEK_START);
    await queryDb(
      `INSERT INTO peer_programming_weekly_topics
       (id, week_start_date, title, guidance, revision_note, status, created_by_user_id, published_by_user_id, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        topicId,
        WEEK_START,
        'Finding Your Voice',
        'This week, focus on articulating your thoughts clearly in the cohort space. Share at least one idea or response to the topic.',
        'Initial publication',
        'published',
        SEED_USER_IDS[0],
        SEED_USER_IDS[0],
      ]
    );

    // Seed cohorts
    const cohortId = deterministicUuid('cohort-' + WEEK_START + '-1');
    await queryDb(
      `INSERT INTO peer_programming_cohorts
       (id, week_start_date, cohort_label, fallback_open, topic_id, assigned_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        cohortId,
        WEEK_START,
        'Cohort 1',
        false,
        topicId,
        SEED_USER_IDS[0],
      ]
    );

    // Seed cohort members
    for (let i = 0; i < SEED_USER_IDS.length; i++) {
      const memberId = deterministicUuid('cohort-member-' + cohortId + '-' + SEED_USER_IDS[i]);
      await queryDb(
        `INSERT INTO peer_programming_cohort_members (id, cohort_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [memberId, cohortId, SEED_USER_IDS[i]]
      );
    }

    // Seed messages
    const messages = [
      { author: SEED_USER_IDS[0], body: 'Excited to be part of this cohort!', parent: null, tier: 'cohort_member' },
      { author: SEED_USER_IDS[1], body: 'Looking forward to hearing everyone\'s perspectives', parent: null, tier: 'cohort_member' },
      { author: SEED_USER_IDS[2], body: 'This is my first time sharing in a group', parent: null, tier: 'cohort_member' },
    ];

    for (const msg of messages) {
      const msgId = deterministicUuid('message-' + cohortId + '-' + msg.author + '-' + msg.body);
      await queryDb(
        `INSERT INTO peer_programming_messages (id, cohort_id, author_user_id, parent_message_id, body, tier)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [msgId, cohortId, msg.author, msg.parent, msg.body, msg.tier]
      );
    }

    // Seed feedback
    const feedbackId = deterministicUuid('feedback-' + cohortId + '-' + SEED_USER_IDS[3]);
    await queryDb(
      `INSERT INTO peer_programming_feedback
       (id, cohort_id, user_id, issue_type, suggestion_category, release_surface, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        feedbackId,
        cohortId,
        SEED_USER_IDS[3],
        'suggestion',
        'engagement',
        'mobile',
        'Would be great to get mobile notifications for cohort updates',
      ]
    );

    // Seed assignment notifications
    for (const userId of SEED_USER_IDS) {
      const notifId = deterministicUuid('notification-' + cohortId + '-' + userId);
      const idempotencyKey = 'assign-' + cohortId + '-' + userId;
      await queryDb(
        `INSERT INTO peer_programming_assignment_notifications
         (id, cohort_id, user_id, idempotency_key, payload, delivered_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          notifId,
          cohortId,
          userId,
          idempotencyKey,
          JSON.stringify({ cohort_label: 'Cohort 1', topic_title: 'Finding Your Voice' }),
        ]
      );
    }

    await queryDb('COMMIT');
    console.log('Seeded PeerProgramming cohorts, topics, members, messages, and feedback.');
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
