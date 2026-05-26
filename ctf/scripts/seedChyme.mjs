#!/usr/bin/env node

import { Pool } from 'pg';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

const databaseUrl = requireEnv('DATABASE_URL');
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

const roomKey = 'chyme-main-room';
const serviceName = 'chyme';

const demoUsers = [
  {
    messageId: '21111111-1111-4111-8111-111111111111',
    deletionEventId: '31111111-1111-4111-8111-111111111111',
    userId: 'seed-chyme-user-001',
    username: 'seed_amina',
    displayName: '@seed_amina',
    avatarUrl: null,
    role: 'speaker',
    message: 'Welcome to the deterministic Chyme seed room.',
  },
  {
    messageId: '21111111-1111-4111-8111-222222222222',
    deletionEventId: '31111111-1111-4111-8111-222222222222',
    userId: 'seed-chyme-user-002',
    username: 'seed_luis',
    displayName: '@seed_luis',
    avatarUrl: null,
    role: 'listener',
    message: 'Seed fixture online and ready for validation.',
  },
];

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const roomResult = await client.query(
      `
        INSERT INTO chyme_rooms (room_key, room_name, call_active)
        VALUES ($1, 'Chyme Main Room', false)
        ON CONFLICT (room_key)
        DO UPDATE SET room_name = EXCLUDED.room_name, updated_at = NOW()
        RETURNING id
      `,
      [roomKey],
    );

    const roomId = roomResult.rows[0].id;

    for (const demoUser of demoUsers) {
      await client.query(
        `
          INSERT INTO chyme_service_profiles (user_id, status, created_at, updated_at, deleted_at)
          VALUES ($1, 'active', NOW(), NOW(), NULL)
          ON CONFLICT (user_id)
          DO UPDATE SET status = 'active', updated_at = NOW(), deleted_at = NULL
        `,
        [demoUser.userId],
      );

      await client.query(
        `
          INSERT INTO chyme_room_members (
            room_id,
            user_id,
            username,
            display_name,
            avatar_url,
            role,
            joined_at,
            last_seen_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT (room_id, user_id)
          DO UPDATE SET
            username = EXCLUDED.username,
            display_name = EXCLUDED.display_name,
            avatar_url = EXCLUDED.avatar_url,
            role = EXCLUDED.role,
            last_seen_at = NOW()
        `,
        [
          roomId,
          demoUser.userId,
          demoUser.username,
          demoUser.displayName,
          demoUser.avatarUrl,
          demoUser.role,
        ],
      );

      await client.query(
        `
          INSERT INTO chyme_messages (id, room_id, user_id, username, display_name, avatar_url, text, sent_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (id)
          DO UPDATE SET
            text = EXCLUDED.text,
            sent_at = NOW()
        `,
        [
          demoUser.messageId,
          roomId,
          demoUser.userId,
          demoUser.username,
          demoUser.displayName,
          demoUser.avatarUrl,
          demoUser.message,
        ],
      );

      await client.query(
        `
          INSERT INTO chyme_deletion_events (id, user_id, scope, service_name, requested_at, status, metadata)
          VALUES ($1, $2, 'service', $3, NOW(), 'completed', '{"seed":true}'::jsonb)
          ON CONFLICT (id)
          DO UPDATE SET
            status = 'completed',
            requested_at = NOW(),
            metadata = '{"seed":true}'::jsonb
        `,
        [demoUser.deletionEventId, demoUser.userId, serviceName],
      );
    }

    await client.query('COMMIT');
    console.log('Chyme phase-0 seed fixtures applied.');
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
