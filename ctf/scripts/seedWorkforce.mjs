#!/usr/bin/env node

import { Pool } from 'pg';
import crypto from 'node:crypto';

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

const occupations = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Community Navigator', sector: 'social-support' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Workforce Mentor', sector: 'education' },
];

const announcements = [
  {
    title: 'Workforce phase-1 seed baseline',
    body: 'Deterministic workforce seed data has been applied for dashboard and admin flow validation.',
  },
];

const seededUsers = [
  {
    userId: 'seed-directory-profile-001',
    occupationId: '11111111-1111-4111-8111-111111111111',
    skillLevel: 'intermediate',
    region: 'us-east',
    recruitedState: true,
  },
  {
    userId: 'seed-directory-profile-002',
    occupationId: '22222222-2222-4222-8222-222222222222',
    skillLevel: 'advanced',
    region: 'us-west',
    recruitedState: true,
  },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const occupation of occupations) {
      await client.query(
        `
          INSERT INTO workforce_occupations (id, name, sector, is_active, created_by_user_id, updated_by_user_id)
          VALUES ($1::uuid, $2, $3, true, 'seed-admin', 'seed-admin')
          ON CONFLICT (id)
          DO UPDATE SET
            name = EXCLUDED.name,
            sector = EXCLUDED.sector,
            is_active = true,
            updated_by_user_id = 'seed-admin',
            updated_at = NOW()
        `,
        [occupation.id, occupation.name, occupation.sector],
      );
    }

    for (const user of seededUsers) {
      await client.query(
        `
          INSERT INTO workforce_profiles
            (user_id, occupation_id, skill_level, region, recruited_state, recruited_resolved_at)
          VALUES
            ($1, $2::uuid, $3, $4, $5, NOW())
          ON CONFLICT (user_id)
          DO UPDATE SET
            occupation_id = EXCLUDED.occupation_id,
            skill_level = EXCLUDED.skill_level,
            region = EXCLUDED.region,
            recruited_state = EXCLUDED.recruited_state,
            recruited_resolved_at = NOW(),
            updated_at = NOW()
        `,
        [user.userId, user.occupationId, user.skillLevel, user.region, user.recruitedState],
      );

      await client.query(
        `
          INSERT INTO workforce_user_extension (user_id, availability_preferences, work_preferences, service_deleted_at)
          VALUES ($1, '{"seed":true}'::jsonb, '{"seed":true}'::jsonb, NULL)
          ON CONFLICT (user_id)
          DO UPDATE SET
            availability_preferences = EXCLUDED.availability_preferences,
            work_preferences = EXCLUDED.work_preferences,
            service_deleted_at = NULL,
            updated_at = NOW()
        `,
        [user.userId],
      );

      const dedupe = crypto
        .createHash('sha256')
        .update(`seed:${user.userId}:${user.occupationId}`)
        .digest('hex');

      await client.query(
        `
          INSERT INTO workforce_recruited_events
            (user_id, directory_profile_id, source_event, inference_dedupe_key, resolved_recruited, resolved_at, metadata)
          VALUES
            ($1, $1, 'workforce_admin_recompute', $2, true, NOW(), '{"seed":true}'::jsonb)
          ON CONFLICT (inference_dedupe_key)
          DO NOTHING
        `,
        [user.userId, dedupe],
      );
    }

    for (const announcement of announcements) {
      await client.query(
        `
          INSERT INTO workforce_announcements
            (title, body, is_active, published_at, expires_at, created_by_user_id, updated_by_user_id)
          VALUES
            ($1, $2, true, NOW(), NULL, 'seed-admin', 'seed-admin')
          ON CONFLICT DO NOTHING
        `,
        [announcement.title, announcement.body],
      );
    }

    await client.query('COMMIT');
    console.log('Workforce phase-1 seed fixtures applied.');
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
