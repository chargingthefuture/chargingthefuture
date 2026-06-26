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

const seedPropertyId = '88888888-8888-4888-8888-888888888888';
const seedMatchId = '99999999-9999-4999-8999-999999999999';

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
        INSERT INTO lighthouse_profiles
          (user_id, profile_type, bio, phone_number, signal_url, is_active, has_property, housing_needs, desired_country)
        VALUES
          ('seed-lighthouse-seeker-01', 'seeker', 'Seed seeker profile for LightHouse validation.', '+10000000001', 'https://signal.me/#seed-seeker', TRUE, FALSE, '2 bedroom near transit', 'US'),
          ('seed-lighthouse-host-01', 'host', 'Seed host profile for LightHouse validation.', '+10000000002', 'https://signal.me/#seed-host', TRUE, TRUE, NULL, 'US')
        ON CONFLICT (user_id)
        DO UPDATE SET
          profile_type = EXCLUDED.profile_type,
          bio = EXCLUDED.bio,
          phone_number = EXCLUDED.phone_number,
          signal_url = EXCLUDED.signal_url,
          is_active = EXCLUDED.is_active,
          has_property = EXCLUDED.has_property,
          housing_needs = EXCLUDED.housing_needs,
          desired_country = EXCLUDED.desired_country,
          updated_at = NOW()
      `,
    );

    await client.query(
      `
        INSERT INTO lighthouse_properties
          (id, host_user_id, title, description, property_type, city, state, country, bedrooms, bathrooms, monthly_rent, rent_currency, amenities, house_rules, photos, is_active, created_by_user_id, updated_by_user_id)
        VALUES
          ($1::uuid, 'seed-lighthouse-host-01', 'Seed LightHouse Property', 'Deterministic property fixture for LightHouse API validation.', 'apartment', 'Austin', 'TX', 'US', 2, 1.5, 2100, 'USD', '["wifi","laundry"]'::jsonb, '["no-smoking"]'::jsonb, '[]'::jsonb, TRUE, 'seed-lighthouse-host-01', 'seed-lighthouse-host-01')
        ON CONFLICT (id)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          property_type = EXCLUDED.property_type,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          country = EXCLUDED.country,
          bedrooms = EXCLUDED.bedrooms,
          bathrooms = EXCLUDED.bathrooms,
          monthly_rent = EXCLUDED.monthly_rent,
          rent_currency = EXCLUDED.rent_currency,
          amenities = EXCLUDED.amenities,
          house_rules = EXCLUDED.house_rules,
          photos = EXCLUDED.photos,
          is_active = EXCLUDED.is_active,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
      `,
      [seedPropertyId],
    );

    await client.query(
      `
        INSERT INTO lighthouse_matches
          (id, property_id, seeker_user_id, host_user_id, message, status, settlement_amount, settlement_currency, settled_at, settlement_recorded_by_user_id, stream_channel_id)
        VALUES
          ($1::uuid, $2::uuid, 'seed-lighthouse-seeker-01', 'seed-lighthouse-host-01', 'Seed match request message.', 'completed', 2100, 'USD', NOW(), 'seed-lighthouse-host-01', 'lighthouse-match-seed-1')
        ON CONFLICT (id)
        DO UPDATE SET
          status = EXCLUDED.status,
          message = EXCLUDED.message,
          settlement_amount = EXCLUDED.settlement_amount,
          settlement_currency = EXCLUDED.settlement_currency,
          settled_at = EXCLUDED.settled_at,
          settlement_recorded_by_user_id = EXCLUDED.settlement_recorded_by_user_id,
          updated_at = NOW()
      `,
      [seedMatchId, seedPropertyId],
    );

    await client.query(
      `
        INSERT INTO lighthouse_blocks (blocker_user_id, blocked_user_id, reason)
        VALUES ('seed-lighthouse-seeker-01', 'seed-lighthouse-host-01', 'seed-validation')
        ON CONFLICT (blocker_user_id, blocked_user_id)
        DO UPDATE SET reason = EXCLUDED.reason
      `,
    );

    await client.query('COMMIT');
    console.log('Lighthouse phase-2 seed fixtures applied.');
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
