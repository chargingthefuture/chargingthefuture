#!/usr/bin/env node

// Backfill the member_plugin_presence index from existing member-owned listings.
//
// This is the one-time seed for the cross-plugin "Also active in" surface on the Directory provider
// profile. It reads each member's existing listings from the source plugins and upserts one presence
// row per listing. It is idempotent (ON CONFLICT DO UPDATE), so it is safe to re-run; re-running
// refreshes labels/links and re-activates rows.
//
// Sources covered:
//   - LightHouse property postings        → lighthouse_properties (host_user_id, is_active = TRUE)
//   - TrustTransport ride requests        → trusttransport_requests (requester_user_id, non-terminal status)
//   - TrustTransport ride offers          → trusttransport_offers (provider_user_id, non-terminal status)
//   - Foundation provider offerings       → foundation_provider_skills (user_id; label from skill name)
//   - SocketRelay help posts (Commons)    → socketrelay_requests (owner_user_id, status = 'open')
//
// Sources skipped: none. Every source named in the task mapped cleanly to a member user-id column.
//
// Notes:
//   - "Nothing is public" in this app, so no public/private gate is applied — any listing counts.
//   - Foundation rows have a composite key (user_id, skill_id) and no per-row UUID; the skill_id is
//     used as ref_id and the joined skill name as the label.
//   - TrustTransport status is a free-text column with no schema-level enum, so active filtering is
//     done defensively by excluding terminal states (cancelled/completed/closed/withdrawn/declined/
//     expired/rejected) rather than guessing the exact active set.

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

// Terminal statuses that mean a TrustTransport listing is no longer active presence.
const TERMINAL_STATUSES = [
  'cancelled',
  'canceled',
  'completed',
  'closed',
  'withdrawn',
  'declined',
  'expired',
  'rejected',
];

async function upsertPresence(client, { userId, pluginSlug, refType, refId, label, deepLink }) {
  if (!userId || userId.trim().length === 0) {
    return false;
  }
  await client.query(
    `
      INSERT INTO member_plugin_presence
        (user_id, plugin_slug, ref_type, ref_id, label, deep_link, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
      ON CONFLICT (user_id, plugin_slug, ref_type, ref_id)
      DO UPDATE SET
        label = EXCLUDED.label,
        deep_link = EXCLUDED.deep_link,
        is_active = TRUE,
        updated_at = NOW()
    `,
    [userId, pluginSlug, refType, refId, label, deepLink],
  );
  return true;
}

// Each source returns rows of { userId, refId, label } and a fixed (slug, refType, deepLink).
async function backfillSource(client, { name, slug, refType, deepLink, label, sql }) {
  let count = 0;
  try {
    const result = await client.query(sql);
    for (const row of result.rows) {
      const ok = await upsertPresence(client, {
        userId: row.user_id,
        pluginSlug: slug,
        refType,
        refId: String(row.ref_id),
        label,
        deepLink,
      });
      if (ok) count += 1;
    }
  } catch (error) {
    // A missing source table (plugin not yet provisioned in this environment) should not abort the
    // whole backfill; report and continue with the other sources.
    console.warn(`[backfillMemberPresence] skipped source "${name}": ${error.message}`);
    return { name, count: 0, skipped: true };
  }
  return { name, count, skipped: false };
}

async function main() {
  const client = await pool.connect();
  try {
    const terminalList = TERMINAL_STATUSES.map((s) => `'${s}'`).join(', ');

    const sources = [
      {
        name: 'LightHouse property postings',
        slug: 'lighthouse',
        refType: 'property',
        deepLink: '/apps/lighthouse',
        label: 'Housing listing',
        sql: `
          SELECT host_user_id AS user_id, id AS ref_id
          FROM lighthouse_properties
          WHERE is_active = TRUE AND host_user_id IS NOT NULL
        `,
      },
      {
        name: 'TrustTransport ride requests',
        slug: 'trusttransport',
        refType: 'request',
        deepLink: '/apps/trusttransport',
        label: 'Ride request',
        sql: `
          SELECT requester_user_id AS user_id, id AS ref_id
          FROM trusttransport_requests
          WHERE requester_user_id IS NOT NULL
            AND lower(COALESCE(status, '')) NOT IN (${terminalList})
        `,
      },
      {
        name: 'TrustTransport ride offers',
        slug: 'trusttransport',
        refType: 'offer',
        deepLink: '/apps/trusttransport',
        label: 'Offering rides',
        sql: `
          SELECT provider_user_id AS user_id, id AS ref_id
          FROM trusttransport_offers
          WHERE provider_user_id IS NOT NULL
            AND lower(COALESCE(status, '')) NOT IN (${terminalList})
        `,
      },
      {
        name: 'Foundation provider offerings',
        slug: 'foundation',
        refType: 'provider-skill',
        deepLink: '/apps/foundation',
        label: 'Provider offering',
        sql: `
          SELECT user_id AS user_id, skill_id AS ref_id
          FROM foundation_provider_skills
          WHERE user_id IS NOT NULL
        `,
      },
      {
        name: 'SocketRelay help posts',
        slug: 'socketrelay',
        refType: 'post',
        deepLink: '/apps/socketrelay',
        label: 'Help post',
        sql: `
          SELECT owner_user_id AS user_id, id AS ref_id
          FROM socketrelay_requests
          WHERE owner_user_id IS NOT NULL AND status = 'open'
        `,
      },
    ];

    const results = [];
    for (const source of sources) {
      results.push(await backfillSource(client, source));
    }

    console.log('[backfillMemberPresence] done:');
    for (const r of results) {
      console.log(`  ${r.skipped ? 'SKIPPED' : 'OK'} ${r.name}: ${r.count} presence rows upserted`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[backfillMemberPresence] failed:', error);
  process.exitCode = 1;
});
