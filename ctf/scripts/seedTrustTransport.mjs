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

const seedRequestId = 'ccccccc3-cccc-4ccc-8ccc-ccccccccccc3';
const seedOfferId = 'ddddddd4-dddd-4ddd-8ddd-ddddddddddd4';
const seedTripId = 'eeeeeee5-eeee-4eee-8eee-eeeeeeeeeee5';

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
        INSERT INTO trusttransport_user_extension
          (user_id, mode_preferences, safety_settings, payout_preferences, provider_eligible, account_restricted, service_deleted_at)
        VALUES
          ('seed-trusttransport-requester-01', '{"preferredMode":"ride"}'::jsonb, '{"emergencyContact":true}'::jsonb, '{}'::jsonb, FALSE, FALSE, NULL),
          ('seed-trusttransport-provider-01', '{"preferredMode":"ride"}'::jsonb, '{"emergencyContact":true}'::jsonb, '{"method":"ledger"}'::jsonb, TRUE, FALSE, NULL)
        ON CONFLICT (user_id)
        DO UPDATE SET
          mode_preferences = EXCLUDED.mode_preferences,
          safety_settings = EXCLUDED.safety_settings,
          payout_preferences = EXCLUDED.payout_preferences,
          provider_eligible = EXCLUDED.provider_eligible,
          account_restricted = EXCLUDED.account_restricted,
          service_deleted_at = NULL,
          updated_at = NOW()
      `,
    );

    await client.query(
      `
        INSERT INTO trusttransport_requests
          (id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, idempotency_key)
        VALUES
          ($1::uuid, 'seed-trusttransport-requester-01', 'ride', 'Seed TrustTransport Ride', 'Deterministic trusttransport request fixture.', 'Austin', 'Round Rock', 'pickup-redacted', 'dropoff-redacted', 'accepted', 'seed-trusttransport-request-01')
        ON CONFLICT (id)
        DO UPDATE SET
          mode = EXCLUDED.mode,
          title = EXCLUDED.title,
          details = EXCLUDED.details,
          pickup_city = EXCLUDED.pickup_city,
          dropoff_city = EXCLUDED.dropoff_city,
          pickup_geo_redacted = EXCLUDED.pickup_geo_redacted,
          dropoff_geo_redacted = EXCLUDED.dropoff_geo_redacted,
          status = EXCLUDED.status,
          updated_at = NOW()
      `,
      [seedRequestId],
    );

    await client.query(
      `
        INSERT INTO trusttransport_offers
          (id, request_id, provider_user_id, note, proposed_amount, status)
        VALUES
          ($1::uuid, $2::uuid, 'seed-trusttransport-provider-01', 'Seed offer note.', 24.50, 'accepted')
        ON CONFLICT (id)
        DO UPDATE SET
          note = EXCLUDED.note,
          proposed_amount = EXCLUDED.proposed_amount,
          status = EXCLUDED.status,
          updated_at = NOW()
      `,
      [seedOfferId, seedRequestId],
    );

    await client.query(
      `
        INSERT INTO trusttransport_trips
          (id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id)
        VALUES
          ($1::uuid, $2::uuid, $3::uuid, 'seed-trusttransport-requester-01', 'seed-trusttransport-provider-01', 'ride', 'en_route', 'trusttransport-trip-seed-1')
        ON CONFLICT (id)
        DO UPDATE SET
          status = EXCLUDED.status,
          stream_channel_id = EXCLUDED.stream_channel_id,
          updated_at = NOW()
      `,
      [seedTripId, seedRequestId, seedOfferId],
    );

    await client.query(
      `
        INSERT INTO trusttransport_status_events (request_id, trip_id, actor_user_id, event_name, from_status, to_status, metadata)
        VALUES
          ($1::uuid, $2::uuid, 'seed-trusttransport-requester-01', 'request_created', NULL, 'open', '{"seed":true}'::jsonb),
          ($1::uuid, $2::uuid, 'seed-trusttransport-requester-01', 'offer_accepted', 'open', 'accepted', '{"seed":true}'::jsonb),
          ($1::uuid, $2::uuid, 'seed-trusttransport-provider-01', 'trip_status_updated', 'assigned', 'en_route', '{"seed":true}'::jsonb)
        ON CONFLICT DO NOTHING
      `,
      [seedRequestId, seedTripId],
    );

    await client.query(
      `
        INSERT INTO trusttransport_earnings_ledger
          (provider_user_id, trip_id, entry_type, amount, currency, status, metadata)
        VALUES
          ('seed-trusttransport-provider-01', $1::uuid, 'credit', 24.50, 'USD', 'posted', '{"seed":true}'::jsonb)
      `,
      [seedTripId],
    );

    // Seed a service credits transaction for TrustTransport
    await client.query(
      `
        INSERT INTO trusttransport_service_credits_transactions
          (from_user_id, to_user_id, amount, reason, trip_id, created_at)
        VALUES
          ('seed-trusttransport-requester-01', 'seed-trusttransport-provider-01', 9, 'Seed TrustTransport service credits', $1::uuid, NOW())
        ON CONFLICT DO NOTHING
      `,
      [seedTripId],
    );

    await client.query('COMMIT');
    console.log('TrustTransport phase-2 seed fixtures applied.');
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
