import { queryDb } from 'lib/db/postgres';
import {
  ClickLogIncident,
  ClickLogPreferences,
  CreateIncidentInput,
  SharedIncidentTagTrend,
  SharedIncidentTrendBucket,
} from './types';

export async function getIncidentById(id: string): Promise<ClickLogIncident | null> {
  const result = await queryDb<ClickLogIncident>(
    `SELECT * FROM click_log_incidents WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function createIncident(input: CreateIncidentInput): Promise<ClickLogIncident> {
  const { userId, metadata, sharedWithOwner, problemTag, schemeTag } = input;
  const result = await queryDb<ClickLogIncident>(
    `INSERT INTO click_log_incidents (id, user_id, metadata, shared_with_owner, problem_tag, scheme_tag, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
     RETURNING *`,
    [userId, metadata, sharedWithOwner, problemTag ?? null, schemeTag ?? null]
  );
  return result.rows[0];
}

// Flips the owner-share flag on a single incident. Owner-scoped only: the member who logged the
// incident is the only one who may change whether it is shared, so there is no admin variant.
export async function setIncidentShared(id: string, userId: string, shared: boolean): Promise<boolean> {
  const result = await queryDb(
    `UPDATE click_log_incidents SET shared_with_owner = $3 WHERE id = $1 AND user_id = $2`,
    [id, userId, shared]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getIncidentsByUser(userId: string, limit = 50): Promise<ClickLogIncident[]> {
  const result = await queryDb<ClickLogIncident>(
    `SELECT * FROM click_log_incidents WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export async function getIncidentCount(userId: string): Promise<number> {
  const result = await queryDb<{ count: string }>(
    `SELECT COUNT(*) FROM click_log_incidents WHERE user_id = $1`,
    [userId]
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

// Reads the member's global share default. A missing row means the member never touched the
// setting, which is the opt-in default: not shared.
export async function getPreferences(userId: string): Promise<ClickLogPreferences> {
  const result = await queryDb<{ share_with_owner: boolean }>(
    `SELECT share_with_owner FROM click_log_preferences WHERE user_id = $1`,
    [userId]
  );
  return { shareWithOwner: result.rows[0]?.share_with_owner ?? false };
}

export async function setPreferences(userId: string, prefs: ClickLogPreferences): Promise<void> {
  await queryDb(
    `INSERT INTO click_log_preferences (user_id, share_with_owner, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET share_with_owner = EXCLUDED.share_with_owner, updated_at = NOW()`,
    [userId, prefs.shareWithOwner]
  );
}

// Owner trends aggregate. Reads ONLY incidents the member opted to share, and returns ONLY coarse
// buckets: UTC day + location rounded to 1 decimal place (~11 km cell) + count. Notes, precise
// coordinates, incident ids, and member identity never leave this query — the privacy boundary is
// enforced here in SQL, not left to the caller.
export async function getSharedIncidentTrends(days = 90): Promise<SharedIncidentTrendBucket[]> {
  const result = await queryDb<{
    day: string;
    latitude_cell: string | null;
    longitude_cell: string | null;
    count: string;
  }>(
    `SELECT
       to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
       round((metadata->>'latitude')::numeric, 1) AS latitude_cell,
       round((metadata->>'longitude')::numeric, 1) AS longitude_cell,
       COUNT(*) AS count
     FROM click_log_incidents
     WHERE shared_with_owner
       AND created_at >= NOW() - make_interval(days => $1)
     GROUP BY 1, 2, 3
     ORDER BY 1 DESC, 4 DESC`,
    [days]
  );
  return result.rows.map((row) => ({
    day: row.day,
    latitudeCell: row.latitude_cell === null ? null : Number(row.latitude_cell),
    longitudeCell: row.longitude_cell === null ? null : Number(row.longitude_cell),
    count: parseInt(row.count, 10),
  }));
}

// Owner tag-trend aggregate. Same privacy boundary as getSharedIncidentTrends: reads ONLY
// incidents the member opted to share, and projects ONLY the tag slug (a coarse categorical
// value from the canonical lists) plus a count — never notes, coordinates, incident ids, or
// member identity. Untagged incidents are simply absent from this aggregate.
export async function getSharedIncidentTagTrends(days = 90): Promise<SharedIncidentTagTrend[]> {
  const result = await queryDb<{ tag_type: 'problem' | 'scheme'; tag: string; count: string }>(
    `SELECT 'problem' AS tag_type, problem_tag AS tag, COUNT(*) AS count
     FROM click_log_incidents
     WHERE shared_with_owner
       AND problem_tag IS NOT NULL
       AND created_at >= NOW() - make_interval(days => $1)
     GROUP BY problem_tag
     UNION ALL
     SELECT 'scheme' AS tag_type, scheme_tag AS tag, COUNT(*) AS count
     FROM click_log_incidents
     WHERE shared_with_owner
       AND scheme_tag IS NOT NULL
       AND created_at >= NOW() - make_interval(days => $1)
     GROUP BY scheme_tag
     ORDER BY count DESC, tag ASC`,
    [days]
  );
  return result.rows.map((row) => ({
    tagType: row.tag_type,
    tag: row.tag,
    count: parseInt(row.count, 10),
  }));
}

// Deletes an incident. Members may delete only their own (the user_id condition
// scopes the DELETE); admins may delete any incident, so for them the ownership
// condition is dropped. The route performs the authorization check (canDeleteIncident)
// before calling this.
export async function deleteIncident(id: string, userId: string, isAdmin = false): Promise<boolean> {
  const result = isAdmin
    ? await queryDb(`DELETE FROM click_log_incidents WHERE id = $1`, [id])
    : await queryDb(`DELETE FROM click_log_incidents WHERE id = $1 AND user_id = $2`, [id, userId]);
  return (result.rowCount ?? 0) > 0;
}
