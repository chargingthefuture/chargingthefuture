import { queryDb } from 'lib/db/postgres';

// The needs landing page visitors picked that matched nobody in the Directory, most asked first.
//
// The landing page adds a row to directory_unmet_needs each time a visitor picks a need whose count
// is 0, once per need per visit, so the owner can see which needs go unmet and look for somebody.
// The owner read them by pasting ctf/scripts/sql/landing_unmet_needs_report.sql into the Neon
// dashboard; this is the same query behind an admin screen, so it can be read from a phone.
//
// Read-only. A row holds the need and its job titles and nothing about the visitor. A need that now
// has people still shows here with its history; lastAsked says how recent the demand is.

export type DirectoryUnmetNeedRow = {
  need: string;
  timesAsked: number;
  firstAsked: string;
  lastAsked: string;
};

type UnmetNeedDbRow = {
  need: string;
  times_asked: string;
  first_asked: Date | string;
  last_asked: Date | string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function listDirectoryUnmetNeeds(): Promise<DirectoryUnmetNeedRow[]> {
  const result = await queryDb<UnmetNeedDbRow>(
    `SELECT need,
            COUNT(*) AS times_asked,
            MIN(created_at) AS first_asked,
            MAX(created_at) AS last_asked
       FROM directory_unmet_needs
      GROUP BY need
      ORDER BY times_asked DESC, last_asked DESC`,
  );
  return result.rows.map((row) => ({
    need: row.need,
    timesAsked: Number(row.times_asked),
    firstAsked: toIso(row.first_asked),
    lastAsked: toIso(row.last_asked),
  }));
}
