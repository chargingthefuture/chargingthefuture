import { queryDb } from 'lib/db/postgres';

// The Chyme readings loop: recorded readings of the blog posts, played on the Chyme page while
// nobody is live, so a visitor who arrives to an empty room hears something instead of nothing.
//
// A temporary module (owner decision, 2026-09-28). It is switched off from /admin/chyme/readings
// once people start showing up, and then deleted. Everything it owns sits in lib/chyme/readings,
// components/chyme/readings, app/api/chyme/readings and app/admin/chyme/readings, plus the
// chyme_readings_config table and one mount line in each Chyme shell, so removing it is removing
// those. The playlist is not stored here: it is the list the blog publishes (see schedule.ts).

export type ReadingsSetting = { enabled: boolean; updatedBy: string | null; updatedAtIso: string | null };

type ConfigRow = { enabled: boolean; updated_by: string | null; updated_at: Date | string };

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
