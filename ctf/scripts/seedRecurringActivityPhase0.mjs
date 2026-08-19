#!/usr/bin/env node

// Recurring Activity seed (issue #885) — a few demo ongoing activities across the states the plugin
// uses (pending / active-fiat / active-ServiceCredits), so the hub, the confirm flow, the Trust
// distinct-counterparty signal, and the GDP recognition source all have real rows to read.
//
// Design rules baked in, matching the schema and the feature inventory:
//   * NO free text — the "description" is the fixed `sector` dropdown only.
//   * A FIAT line carries NO amount (sc_value stays NULL); only the ServiceCredits line has a value.
//   * `active` means the counterparty confirmed it; only `active` rows feed Trust or GDP.
// Deterministic UUIDs + fixed timestamps so re-running is idempotent and byte-for-byte stable.

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

const memberA = 'seed-recurring-activity-member-001';
const memberB = 'seed-recurring-activity-member-002';
const memberC = 'seed-recurring-activity-member-003';

const ACTIVE_FIAT_HOUSING = '00000000-3ac7-4000-a000-000000000001';
const ACTIVE_SC_SERVICE = '00000000-3ac7-4000-a000-000000000002';
const PENDING_FIAT_FAVOR = '00000000-3ac7-4000-a000-000000000003';

const CONFIRMED_AT = '2026-06-20T00:00:00.000Z';

async function upsertActivity(client, a) {
  await client.query(
    `
      INSERT INTO recurring_activities (
        id, owner_user_id, counterparty_user_id, sector, currency_code, cadence,
        sc_value, status, visibility, confirmed_at
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        owner_user_id = EXCLUDED.owner_user_id,
        counterparty_user_id = EXCLUDED.counterparty_user_id,
        sector = EXCLUDED.sector,
        currency_code = EXCLUDED.currency_code,
        cadence = EXCLUDED.cadence,
        sc_value = EXCLUDED.sc_value,
        status = EXCLUDED.status,
        visibility = EXCLUDED.visibility,
        confirmed_at = EXCLUDED.confirmed_at,
        updated_at = NOW()
    `,
    [
      a.id,
      a.ownerUserId,
      a.counterpartyUserId,
      a.sector,
      a.currencyCode,
      a.cadence,
      a.scValue ?? null,
      a.status,
      a.visibility,
      a.confirmedAt ?? null,
    ],
  );
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const activities = [
      {
        // Confirmed fiat housing tie (member A rents from member B, monthly, in USD). NO amount is
        // stored — this feeds GDP by count (one RACT) and Trust by distinct counterparty only.
        id: ACTIVE_FIAT_HOUSING,
        ownerUserId: memberA,
        counterpartyUserId: memberB,
        sector: 'housing',
        currencyCode: 'USD',
        cadence: 'monthly',
        scValue: null,
        status: 'active',
        visibility: 'private',
        confirmedAt: CONFIRMED_AT,
      },
      {
        // Confirmed ServiceCredits service tie (member A pays member C 50 SC/month). ServiceCredits is
        // an internal credits unit, so a declared value is allowed — it feeds GDP by value (50 SC),
        // never as an executed transfer.
        id: ACTIVE_SC_SERVICE,
        ownerUserId: memberA,
        counterpartyUserId: memberC,
        sector: 'service',
        currencyCode: 'SC',
        cadence: 'monthly',
        scValue: 50,
        status: 'active',
        visibility: 'private',
        confirmedAt: CONFIRMED_AT,
      },
      {
        // Pending fiat favor tie awaiting member C's confirmation — counts toward nothing until
        // confirmed. Demonstrates the two-sided guard.
        id: PENDING_FIAT_FAVOR,
        ownerUserId: memberB,
        counterpartyUserId: memberC,
        sector: 'favor',
        currencyCode: 'EUR',
        cadence: 'weekly',
        scValue: null,
        status: 'pending',
        visibility: 'private',
        confirmedAt: null,
      },
    ];

    for (const activity of activities) {
      await upsertActivity(client, activity);
    }

    await client.query('COMMIT');
    console.log('recurring-activity seed fixtures applied.');
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
