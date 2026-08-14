#!/usr/bin/env node

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

const seedUserId = 'seed-comic-user-001';
const seedReviewerId = 'seed-comic-admin-001';

// Fixed timestamp so re-running the seed is byte-for-byte deterministic (no `new Date()` drift).
const DECIDED_AT = '2026-05-31T00:00:00.000Z';

// Deterministic UUIDs so re-running the seed is idempotent (ON CONFLICT (id) DO UPDATE).
const CONVERSATION_ID = '00000000-c0m1-4000-a000-000000000001';

// Turn ids: pairs of (user question, bot/human draft) plus one safety-flagged user turn, plus the
// reviewer's published human answer turn for the corrected item.
const TURN_USER_HOUSING = '00000000-c0m1-4000-a000-000000000101';
const TURN_BOT_HOUSING = '00000000-c0m1-4000-a000-000000000102';
const TURN_USER_SERVICES = '00000000-c0m1-4000-a000-000000000103';
const TURN_BOT_SERVICES = '00000000-c0m1-4000-a000-000000000104';
const TURN_USER_SAFETY = '00000000-c0m1-4000-a000-000000000105';
const TURN_HUMAN_SERVICES = '00000000-c0m1-4000-a000-000000000106';

// The reviewer's corrected answer for the services item (published as a human turn + linked).
const SERVICES_CORRECTED_BODY =
  'Use the Foundation provider directory to find verified providers, and keep first contact inside the platform.';

const REVIEW_HOUSING = '00000000-c0m1-4000-a000-000000000201';
const REVIEW_SERVICES = '00000000-c0m1-4000-a000-000000000202';
const REVIEW_SAFETY = '00000000-c0m1-4000-a000-000000000203';

const TRAINING_HOUSING = '00000000-c0m1-4000-a000-000000000301';
const TRAINING_SERVICES = '00000000-c0m1-4000-a000-000000000302';

async function upsertConversation(client) {
  await client.query(
    `
      INSERT INTO comic_conversations (id, user_id, channel, status)
      VALUES ($1::uuid, $2, 'commons', 'open')
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        channel = EXCLUDED.channel,
        status = EXCLUDED.status,
        updated_at = NOW()
    `,
    [CONVERSATION_ID, seedUserId],
  );
}

async function upsertTurn(client, turn) {
  await client.query(
    `
      INSERT INTO comic_turns (id, conversation_id, role, body, intent, nlu_confidence, engine)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        conversation_id = EXCLUDED.conversation_id,
        role = EXCLUDED.role,
        body = EXCLUDED.body,
        intent = EXCLUDED.intent,
        nlu_confidence = EXCLUDED.nlu_confidence,
        engine = EXCLUDED.engine
    `,
    [turn.id, CONVERSATION_ID, turn.role, turn.body, turn.intent ?? null, turn.confidence ?? null, turn.engine],
  );
}

async function upsertReview(client, review) {
  await client.query(
    `
      INSERT INTO comic_review_queue (id, turn_id, status, reviewer_user_id, corrected_body, answer_turn_id, reason, decided_at)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7, $8::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        turn_id = EXCLUDED.turn_id,
        status = EXCLUDED.status,
        reviewer_user_id = EXCLUDED.reviewer_user_id,
        corrected_body = EXCLUDED.corrected_body,
        answer_turn_id = EXCLUDED.answer_turn_id,
        reason = EXCLUDED.reason,
        decided_at = EXCLUDED.decided_at
    `,
    [
      review.id,
      review.turnId,
      review.status,
      review.reviewerUserId ?? null,
      review.correctedBody ?? null,
      review.answerTurnId ?? null,
      review.reason ?? null,
      review.decidedAt ?? null,
    ],
  );
}

async function upsertTraining(client, example) {
  await client.query(
    `
      INSERT INTO comic_training_examples (id, source_turn_id, intent_label, text, entities, status)
      VALUES ($1::uuid, $2::uuid, $3, $4, '[]'::jsonb, $5)
      ON CONFLICT (id) DO UPDATE SET
        source_turn_id = EXCLUDED.source_turn_id,
        intent_label = EXCLUDED.intent_label,
        text = EXCLUDED.text,
        status = EXCLUDED.status
    `,
    [example.id, example.sourceTurnId, example.intentLabel, example.text, example.status],
  );
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await upsertConversation(client);

    const turns = [
      {
        id: TURN_USER_HOUSING,
        role: 'user',
        body: 'What housing options are available near me right now?',
        engine: 'human',
      },
      {
        id: TURN_BOT_HOUSING,
        role: 'bot',
        body: 'Draft pending review. Start with verified housing listings in Directory and LightHouse with clear move-in windows.',
        engine: 'ollama',
      },
      {
        id: TURN_USER_SERVICES,
        role: 'user',
        body: 'How do I find a support service provider I can trust?',
        engine: 'human',
      },
      {
        id: TURN_BOT_SERVICES,
        role: 'bot',
        body: 'Draft pending review. Focus on verified Foundation providers with safe handoff paths before sharing private details.',
        engine: 'ollama',
      },
      {
        id: TURN_HUMAN_SERVICES,
        role: 'human',
        body: SERVICES_CORRECTED_BODY,
        intent: 'general',
        engine: 'human',
      },
      {
        id: TURN_USER_SAFETY,
        role: 'user',
        body: 'I think I am being followed and I feel threatened.',
        engine: 'human',
      },
    ];

    for (const turn of turns) {
      await upsertTurn(client, turn);
    }

    // Populated review queue: one pending interim-review draft, one corrected (resolved), one
    // pending safety-flagged human-first turn.
    const reviews = [
      {
        id: REVIEW_HOUSING,
        turnId: TURN_BOT_HOUSING,
        status: 'pending',
        reason: 'interim_human_review',
      },
      {
        id: REVIEW_SERVICES,
        turnId: TURN_BOT_SERVICES,
        status: 'corrected',
        reviewerUserId: seedReviewerId,
        correctedBody: SERVICES_CORRECTED_BODY,
        answerTurnId: TURN_HUMAN_SERVICES,
        reason: 'interim_human_review',
        decidedAt: DECIDED_AT,
      },
      {
        id: REVIEW_SAFETY,
        turnId: TURN_USER_SAFETY,
        status: 'pending',
        reason: 'safety:immediate_danger',
      },
    ];

    for (const review of reviews) {
      await upsertReview(client, review);
    }

    // Training examples derived from owner corrections (asker questions under coarse intents).
    const training = [
      {
        id: TRAINING_HOUSING,
        sourceTurnId: TURN_BOT_HOUSING,
        intentLabel: 'general',
        text: 'What housing options are available near me right now?',
        status: 'pending',
      },
      {
        id: TRAINING_SERVICES,
        sourceTurnId: TURN_BOT_SERVICES,
        intentLabel: 'general',
        text: 'How do I find a support service provider I can trust?',
        status: 'pending',
      },
    ];

    for (const example of training) {
      await upsertTraining(client, example);
    }

    await client.query('COMMIT');
    console.log('comic (@comic AI Assistant) phase-0 seed fixtures applied.');
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
