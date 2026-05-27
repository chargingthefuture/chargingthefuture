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

const seedUserId = 'seed-feed-user-001';
const seedAdminId = 'seed-feed-admin-001';

async function ensureFeedConfig(client) {
  await client.query(
    `
      INSERT INTO feed_render_config (singleton_key, render_mode, kill_switch_enabled, max_timeline_page_size, updated_by_user_id)
      VALUES (TRUE, 'card_only', FALSE, 50, $1)
      ON CONFLICT (singleton_key)
      DO UPDATE SET
        render_mode = EXCLUDED.render_mode,
        kill_switch_enabled = EXCLUDED.kill_switch_enabled,
        max_timeline_page_size = EXCLUDED.max_timeline_page_size,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
    `,
    [seedAdminId],
  );
}

async function upsertAnnouncement(client, data) {
  const result = await client.query(
    `
      INSERT INTO announcements
        (title, body, status, priority, mandatory, schedule_at, published_at, expires_at, targeting, created_by_user_id, updated_by_user_id)
      VALUES
        ($1, $2, $3, $4, $5, NULL, $6::timestamptz, $7::timestamptz, $8::jsonb, $9, $9)
      ON CONFLICT DO NOTHING
      RETURNING id
    `,
    [
      data.title,
      data.body,
      data.status,
      data.priority,
      data.mandatory,
      data.publishedAt,
      data.expiresAt,
      JSON.stringify(data.targeting),
      seedAdminId,
    ],
  );

  if (result.rows.length > 0) {
    return result.rows[0].id;
  }

  const existing = await client.query(
    `
      SELECT id
      FROM announcements
      WHERE title = $1
      LIMIT 1
    `,
    [data.title],
  );

  return existing.rows[0].id;
}

async function ensureFeedItemForAnnouncement(client, announcementId, data) {
  const feedItem = await client.query(
    `
      INSERT INTO feed_items
        (item_type, source_announcement_id, title, body, priority, mandatory, published_at, expires_at, is_active, created_by_user_id, updated_by_user_id)
      VALUES
        ('announcement', $1::uuid, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, TRUE, $8, $8)
      ON CONFLICT (source_announcement_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        priority = EXCLUDED.priority,
        mandatory = EXCLUDED.mandatory,
        published_at = EXCLUDED.published_at,
        expires_at = EXCLUDED.expires_at,
        is_active = EXCLUDED.is_active,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
      RETURNING id
    `,
    [announcementId, data.title, data.body, data.priority, data.mandatory, data.publishedAt, data.expiresAt, seedAdminId],
  );

  const feedItemId = feedItem.rows[0].id;
  await client.query('DELETE FROM feed_item_targets WHERE item_id = $1::uuid', [feedItemId]);

  for (const role of data.targeting.roles) {
    await client.query(
      `
        INSERT INTO feed_item_targets (item_id, target_role, target_plugin, target_region)
        VALUES ($1::uuid, $2, NULL, NULL)
        ON CONFLICT (item_id, target_role, target_plugin, target_region)
        DO NOTHING
      `,
      [feedItemId, role],
    );
  }

  await client.query(
    `
      INSERT INTO feed_user_read_state (user_id, item_id, read_at)
      VALUES ($1, $2::uuid, NOW())
      ON CONFLICT (user_id, item_id)
      DO UPDATE SET read_at = EXCLUDED.read_at
    `,
    [seedUserId, feedItemId],
  );

  if (!data.mandatory) {
    await client.query(
      `
        INSERT INTO feed_user_dismissals (user_id, item_id, dismissed_at)
        VALUES ($1, $2::uuid, NOW())
        ON CONFLICT (user_id, item_id)
        DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at
      `,
      [seedUserId, feedItemId],
    );
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `
        INSERT INTO feed_user_extension (user_id, toast_mode_enabled, render_mode, service_deleted_at)
        VALUES ($1, FALSE, 'card_only', NULL)
        ON CONFLICT (user_id)
        DO UPDATE SET toast_mode_enabled = EXCLUDED.toast_mode_enabled,
                      render_mode = EXCLUDED.render_mode,
                      service_deleted_at = NULL,
                      updated_at = NOW()
      `,
      [seedUserId],
    );

    await ensureFeedConfig(client);

    const publishedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const items = [
      {
        title: 'Feed phase-0 seed announcement',
        body: 'Deterministic feed + announcements seed fixture for phase-0 validation.',
        status: 'published',
        priority: 90,
        mandatory: true,
        publishedAt,
        expiresAt,
        targeting: { roles: ['member'] },
      },
      {
        title: 'Optional admin update',
        body: 'Optional announcement to validate dismiss behavior.',
        status: 'published',
        priority: 50,
        mandatory: false,
        publishedAt,
        expiresAt,
        targeting: { roles: ['member', 'admin'] },
      },
    ];

    for (const item of items) {
      const announcementId = await upsertAnnouncement(client, item);

      await client.query(
        `
          INSERT INTO announcement_revisions (announcement_id, revision_number, title, body, targeting, created_by_user_id)
          VALUES ($1::uuid, 1, $2, $3, $4::jsonb, $5)
          ON CONFLICT (announcement_id, revision_number)
          DO NOTHING
        `,
        [announcementId, item.title, item.body, JSON.stringify(item.targeting), seedAdminId],
      );

      await client.query(
        `
          INSERT INTO announcement_delivery_events (announcement_id, event_type, payload, created_by_user_id)
          VALUES ($1::uuid, 'published', $2::jsonb, $3)
          ON CONFLICT DO NOTHING
        `,
        [announcementId, JSON.stringify({ seeded: true }), seedAdminId],
      );

      await client.query(
        `
          INSERT INTO announcement_user_state (user_id, announcement_id, read_at, updated_at)
          VALUES ($1, $2::uuid, NOW(), NOW())
          ON CONFLICT (user_id, announcement_id)
          DO UPDATE SET read_at = EXCLUDED.read_at, updated_at = NOW()
        `,
        [seedUserId, announcementId],
      );

      if (!item.mandatory) {
        await client.query(
          `
            UPDATE announcement_user_state
            SET dismissed_at = NOW(), updated_at = NOW()
            WHERE user_id = $1 AND announcement_id = $2::uuid
          `,
          [seedUserId, announcementId],
        );
      }

      await ensureFeedItemForAnnouncement(client, announcementId, item);
    }

    await client.query(
      `
        INSERT INTO feed_membership_events (actor_id, user_id, plugin_id, event_type, request_id, trace_id)
        VALUES ($1, $2, 'directory', 'join', 'seed-request', 'seed-trace')
      `,
      [seedAdminId, seedUserId],
    );

    await client.query(
      `
        INSERT INTO announcement_membership_events (actor_id, user_id, plugin_id, event_type, request_id, trace_id)
        VALUES ($1, $2, 'directory', 'join', 'seed-request', 'seed-trace')
      `,
      [seedAdminId, seedUserId],
    );

    await client.query('COMMIT');
    console.log('Feed + Announcements phase-0 seed fixtures applied.');
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
