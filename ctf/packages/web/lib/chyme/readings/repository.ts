import { queryDb } from 'lib/db/postgres';
import type { ReadingsTrack } from './schedule';

// The Chyme readings loop: recorded readings of the blog posts, played on the Chyme page while
// nobody is live, so a visitor who arrives to an empty room hears something instead of nothing.
//
// A temporary module (owner decision, 2026-09-28). It is switched off from /admin/chyme/readings
// once people start showing up, and then deleted. Everything it owns sits in lib/chyme/readings,
// components/chyme/readings, app/api/chyme/readings and app/admin/chyme/readings, plus the two
// chyme_readings_* tables and one mount line in each Chyme shell, so removing it is removing those.

export type ReadingsSetting = { enabled: boolean; updatedBy: string | null; updatedAtIso: string | null };

type ConfigRow = { enabled: boolean; updated_by: string | null; updated_at: Date | string };
type TrackRow = { id: string; title: string; post_url: string | null; audio_url: string; duration_seconds: number };

// No row means off: the loop only plays once the owner has switched it on.
export async function getReadingsSetting(): Promise<ReadingsSetting> {
  const result = await queryDb<ConfigRow>(
    `SELECT enabled, updated_by, updated_at FROM chyme_readings_config WHERE singleton_id LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) return { enabled: false, updatedBy: null, updatedAtIso: null };
  return { enabled: row.enabled, updatedBy: row.updated_by, updatedAtIso: new Date(row.updated_at).toISOString() };
}

export async function setReadingsEnabled(actorId: string, enabled: boolean): Promise<ReadingsSetting> {
  await queryDb(
    `INSERT INTO chyme_readings_config (singleton_id, enabled, updated_by, updated_at)
     VALUES (TRUE, $1, $2, NOW())
     ON CONFLICT (singleton_id) DO UPDATE
       SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [enabled, actorId],
  );
  return getReadingsSetting();
}

export async function listReadingsTracks(): Promise<ReadingsTrack[]> {
  const result = await queryDb<TrackRow>(
    `SELECT id, title, post_url, audio_url, duration_seconds FROM chyme_readings_tracks ORDER BY created_at, id`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    postUrl: row.post_url,
    audioUrl: row.audio_url,
    durationSeconds: row.duration_seconds,
  }));
}

export type NewReadingsTrack = { title: string; postUrl: string | null; audioUrl: string; durationSeconds: number };

export async function addReadingsTrack(actorId: string, track: NewReadingsTrack): Promise<string> {
  const result = await queryDb<{ id: string }>(
    `INSERT INTO chyme_readings_tracks (title, post_url, audio_url, duration_seconds, added_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [track.title, track.postUrl, track.audioUrl, track.durationSeconds, actorId],
  );
  return result.rows[0].id;
}

// Returns whether a row was removed, so the route can say "not found" rather than "removed".
export async function removeReadingsTrack(id: string): Promise<boolean> {
  const result = await queryDb(`DELETE FROM chyme_readings_tracks WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

// Only https links are accepted, so the page never plays a file over an unencrypted connection.
export function parseHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    // no-trace: a malformed link is answered as an invalid field by the caller, with the field named.
    return null;
  }
}
