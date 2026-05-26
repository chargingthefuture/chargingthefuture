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

const providerProfileId = '77777777-7777-4777-8777-777777777777';

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
        INSERT INTO directory_profiles
          (id, claimed_by_user_id, display_name, headline, bio, profile_url, is_public, is_active)
        VALUES
          ($1::uuid, 'seed-provider-01', 'Seed Provider', 'Trauma-informed support specialist', 'Seed provider profile for Foundation flow validation.', 'https://example.com/provider/seed', TRUE, TRUE)
        ON CONFLICT (id)
        DO UPDATE SET
          claimed_by_user_id = EXCLUDED.claimed_by_user_id,
          display_name = EXCLUDED.display_name,
          headline = EXCLUDED.headline,
          bio = EXCLUDED.bio,
          profile_url = EXCLUDED.profile_url,
          is_public = EXCLUDED.is_public,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
      `,
      [providerProfileId],
    );

    await client.query(
      `
        INSERT INTO foundation_connection_threads
          (survivor_user_id, provider_user_id, provider_directory_profile_id, stream_channel_id, status, created_by_user_id)
        VALUES
          ('seed-survivor-01', 'seed-provider-01', $1::uuid, 'foundation-thread-seed-1', 'active', 'seed-survivor-01')
        ON CONFLICT (survivor_user_id, provider_user_id)
        DO UPDATE SET
          provider_directory_profile_id = EXCLUDED.provider_directory_profile_id,
          status = 'active',
          updated_at = NOW()
      `,
      [providerProfileId],
    );

    await client.query(
      `
        INSERT INTO foundation_notification_events
          (user_id, kind, title, body, metadata)
        VALUES
          ('seed-survivor-01', 'seed.notification', 'Foundation seed applied', 'Foundation deterministic seed fixtures are available.', '{"seed":true}'::jsonb)
        ON CONFLICT DO NOTHING
      `,
    );

    // Seed a service credits transaction for Foundation
    await client.query(
      `
        INSERT INTO foundation_service_credits_transactions
          (from_user_id, to_user_id, amount, reason, connection_thread_id, created_at)
        VALUES
          ('seed-provider-01', 'seed-survivor-01', 7, 'Seed Foundation service credits', 'foundation-thread-seed-1', NOW())
        ON CONFLICT DO NOTHING
      `
    );

    await client.query('COMMIT');
    console.log('Foundation phase-1 seed fixtures applied.');
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
