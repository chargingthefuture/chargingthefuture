import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';
import type { DailyPostThemeId } from './themes';

// Storage for /admin/daily-posts: what was pasted on which day, the owner's templates, and the
// posts whose theme groups were set by hand. Tables are described in schema.sql.

export type DailyPostTemplate = { id: string; title: string; body: string; updatedAt: string };

/** item_key → the days it was ticked, newest first, as YYYY-MM-DD. */
export async function listTicks(): Promise<Map<string, string[]>> {
  const result = await queryDb<{ item_key: string; posted_on: string }>(
    `SELECT item_key, to_char(posted_on, 'YYYY-MM-DD') AS posted_on
       FROM admin_daily_post_ticks
      ORDER BY posted_on DESC`,
  );
  const ticks = new Map<string, string[]>();
  for (const row of result.rows) {
    const days = ticks.get(row.item_key) ?? [];
    days.push(row.posted_on);
    ticks.set(row.item_key, days);
  }
  return ticks;
}

/** Returns whether the tick changed anything, so a repeated tap writes no second audit row. */
export async function setTick(itemKey: string, postedOn: string, done: boolean): Promise<boolean> {
  const result = done
    ? await queryDb(
        `INSERT INTO admin_daily_post_ticks (item_key, posted_on) VALUES ($1, $2::date)
         ON CONFLICT (item_key, posted_on) DO NOTHING`,
        [itemKey, postedOn],
      )
    : await queryDb(`DELETE FROM admin_daily_post_ticks WHERE item_key = $1 AND posted_on = $2::date`, [itemKey, postedOn]);
  return (result.rowCount ?? 0) > 0;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function listTemplates(): Promise<DailyPostTemplate[]> {
  const result = await queryDb<{ id: string; title: string; body: string; updated_at: string | Date }>(
    `SELECT id, title, body, updated_at FROM admin_daily_post_templates ORDER BY created_at ASC`,
  );
  return result.rows.map((row) => ({ id: row.id, title: row.title, body: row.body, updatedAt: toIso(row.updated_at) }));
}

export async function getTemplate(id: string): Promise<DailyPostTemplate | null> {
  const result = await queryDb<{ id: string; title: string; body: string; updated_at: string | Date }>(
    `SELECT id, title, body, updated_at FROM admin_daily_post_templates WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? { id: row.id, title: row.title, body: row.body, updatedAt: toIso(row.updated_at) } : null;
}

export async function createTemplate(title: string, body: string): Promise<DailyPostTemplate> {
  const result = await queryDb<{ id: string; title: string; body: string; updated_at: string | Date }>(
    `INSERT INTO admin_daily_post_templates (title, body) VALUES ($1, $2) RETURNING id, title, body, updated_at`,
    [title, body],
  );
  const row = result.rows[0];
  return { id: row.id, title: row.title, body: row.body, updatedAt: toIso(row.updated_at) };
}

export async function updateTemplate(id: string, title: string, body: string): Promise<DailyPostTemplate | null> {
  const result = await queryDb<{ id: string; title: string; body: string; updated_at: string | Date }>(
    `UPDATE admin_daily_post_templates SET title = $2, body = $3, updated_at = NOW()
      WHERE id = $1 RETURNING id, title, body, updated_at`,
    [id, title, body],
  );
  const row = result.rows[0];
  return row ? { id: row.id, title: row.title, body: row.body, updatedAt: toIso(row.updated_at) } : null;
}

/** Removes the template and its ticks, which point at nothing once it is gone. */
export async function deleteTemplate(id: string): Promise<void> {
  await queryDb(`DELETE FROM admin_daily_post_ticks WHERE item_key = $1`, [`template:${id}`]);
  await queryDb(`DELETE FROM admin_daily_post_templates WHERE id = $1`, [id]);
}

/** post slug → the theme groups the owner chose for it. */
export async function listThemeChoices(): Promise<Map<string, DailyPostThemeId[]>> {
  const result = await queryDb<{ post_slug: string; themes: string[] }>(
    `SELECT post_slug, themes FROM admin_daily_post_theme_choices`,
  );
  return new Map(result.rows.map((row) => [row.post_slug, row.themes as DailyPostThemeId[]]));
}

/** null clears the choice, so the post goes back to the groups its own links put it in. */
export async function setThemeChoice(postSlug: string, themes: DailyPostThemeId[] | null): Promise<void> {
  if (themes === null) {
    await queryDb(`DELETE FROM admin_daily_post_theme_choices WHERE post_slug = $1`, [postSlug]);
    return;
  }
  await queryDb(
    `INSERT INTO admin_daily_post_theme_choices (post_slug, themes) VALUES ($1, $2::text[])
     ON CONFLICT (post_slug) DO UPDATE SET themes = EXCLUDED.themes, updated_at = NOW()`,
    [postSlug, themes],
  );
}

/** The slugs of the posts left out of the rotation, its theme groups and Today's stories. */
export async function listExclusions(): Promise<Set<string>> {
  const result = await queryDb<{ post_slug: string }>(`SELECT post_slug FROM admin_daily_post_exclusions`);
  return new Set(result.rows.map((row) => row.post_slug));
}

/** Leave a post out, or bring it back. True when something changed. */
export async function setExclusion(postSlug: string, excluded: boolean): Promise<boolean> {
  const result = excluded
    ? await queryDb(`INSERT INTO admin_daily_post_exclusions (post_slug) VALUES ($1) ON CONFLICT (post_slug) DO NOTHING`, [postSlug])
    : await queryDb(`DELETE FROM admin_daily_post_exclusions WHERE post_slug = $1`, [postSlug]);
  return (result.rowCount ?? 0) > 0;
}

export type DailyPostsAuditEvent = {
  actorId: string;
  command:
    | 'admin.daily_posts.tick.set'
    | 'admin.daily_posts.template.create'
    | 'admin.daily_posts.template.update'
    | 'admin.daily_posts.template.delete'
    | 'admin.daily_posts.theme_choice.set'
    | 'admin.daily_posts.exclusion.set';
  targetType: 'tick' | 'template' | 'theme_choice' | 'exclusion';
  targetId: string;
  metadata: Record<string, unknown>;
};

// Never throws. The change it records is already saved; a failed write is reported instead.
export async function recordDailyPostsAudit(event: DailyPostsAuditEvent): Promise<void> {
  try {
    await queryDb(
      `
        INSERT INTO admin_daily_posts_audit_trail
          (actor_id, command, policy_status, reason, target_type, target_id, result, error_category, metadata)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [event.actorId, event.command, 'allow', 'admin_route_guard', event.targetType, event.targetId, 'success', null, JSON.stringify(event.metadata)],
    );
  } catch (error) {
    reportError(error, { area: 'admin-daily-posts', op: 'admin_audit_write' });
  }
}
