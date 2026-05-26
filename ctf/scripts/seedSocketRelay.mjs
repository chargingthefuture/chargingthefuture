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

const seedRequestId = 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const seedFulfillmentId = 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2';

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
        INSERT INTO socketrelay_user_extension
          (user_id, display_name, bio, relay_preferences, presence_opt_in, service_deleted_at)
        VALUES
          ('seed-socketrelay-owner-01', 'SocketRelay Owner', 'Seed owner profile for SocketRelay validation.', '{"notifications":"all"}'::jsonb, TRUE, NULL),
          ('seed-socketrelay-fulfiller-01', 'SocketRelay Fulfiller', 'Seed fulfiller profile for SocketRelay validation.', '{"notifications":"mentions"}'::jsonb, TRUE, NULL)
        ON CONFLICT (user_id)
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          bio = EXCLUDED.bio,
          relay_preferences = EXCLUDED.relay_preferences,
          presence_opt_in = EXCLUDED.presence_opt_in,
          service_deleted_at = NULL,
          updated_at = NOW()
      `,
    );

    await client.query(
      `
        INSERT INTO socketrelay_requests
          (id, owner_user_id, title, details, category, city, is_public, status, idempotency_key, reopened_count, claimed_fulfillment_id)
        VALUES
          ($1::uuid, 'seed-socketrelay-owner-01', 'Seed SocketRelay Request', 'Deterministic request fixture for SocketRelay API validation.', 'logistics', 'Austin', TRUE, 'claimed', 'seed-socketrelay-request-01', 0, $2::uuid)
        ON CONFLICT (id)
        DO UPDATE SET
          title = EXCLUDED.title,
          details = EXCLUDED.details,
          category = EXCLUDED.category,
          city = EXCLUDED.city,
          is_public = EXCLUDED.is_public,
          status = EXCLUDED.status,
          claimed_fulfillment_id = EXCLUDED.claimed_fulfillment_id,
          updated_at = NOW()
      `,
      [seedRequestId, seedFulfillmentId],
    );

    await client.query(
      `
        INSERT INTO socketrelay_fulfillments
          (id, request_id, requester_user_id, fulfiller_user_id, status, close_reason)
        VALUES
          ($1::uuid, $2::uuid, 'seed-socketrelay-owner-01', 'seed-socketrelay-fulfiller-01', 'active', NULL)
        ON CONFLICT (id)
        DO UPDATE SET
          status = EXCLUDED.status,
          close_reason = EXCLUDED.close_reason,
          updated_at = NOW()
      `,
      [seedFulfillmentId, seedRequestId],
    );

    await client.query(
      `
        INSERT INTO socketrelay_fulfillment_participants
          (fulfillment_id, user_id, participant_role)
        VALUES
          ($1::uuid, 'seed-socketrelay-owner-01', 'requester'),
          ($1::uuid, 'seed-socketrelay-fulfiller-01', 'fulfiller')
        ON CONFLICT (fulfillment_id, user_id)
        DO UPDATE SET participant_role = EXCLUDED.participant_role
      `,
      [seedFulfillmentId],
    );

    await client.query(
      `
        INSERT INTO socketrelay_messages
          (fulfillment_id, sender_user_id, message_text, client_message_id, moderation_status)
        VALUES
          ($1::uuid, 'seed-socketrelay-owner-01', 'Seed message from requester.', 'seed-msg-1', 'accepted'),
          ($1::uuid, 'seed-socketrelay-fulfiller-01', 'Seed reply from fulfiller.', 'seed-msg-2', 'accepted')
        ON CONFLICT (fulfillment_id, sender_user_id, client_message_id)
        DO UPDATE SET
          message_text = EXCLUDED.message_text,
          moderation_status = EXCLUDED.moderation_status
      `,
      [seedFulfillmentId],
    );

    await client.query(
      `
        INSERT INTO socketrelay_request_events (request_id, actor_user_id, event_name, metadata)
        VALUES
          ($1::uuid, 'seed-socketrelay-owner-01', 'request_created', '{"seed":true}'::jsonb),
          ($1::uuid, 'seed-socketrelay-fulfiller-01', 'request_claimed', jsonb_build_object('seed', true, 'fulfillmentId', $2::uuid))
        ON CONFLICT DO NOTHING
      `,
      [seedRequestId, seedFulfillmentId],
    );

    // Seed a service credits transaction for SocketRelay
    await client.query(
      `
        INSERT INTO socketrelay_service_credits_transactions
          (from_user_id, to_user_id, amount, reason, fulfillment_id, created_at)
        VALUES
          ('seed-socketrelay-owner-01', 'seed-socketrelay-fulfiller-01', 6, 'Seed SocketRelay service credits', $1::uuid, NOW())
        ON CONFLICT DO NOTHING
      `,
      [seedFulfillmentId],
    );

    await client.query('COMMIT');
    console.log('SocketRelay phase-2 seed fixtures applied.');
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
