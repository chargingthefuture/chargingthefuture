import { queryDb } from 'lib/db/postgres';
import type { MutualTimeMeetingPlugin } from './constants';
import { meetingPluginName } from './meeting-plugin';

// Mutual Time surveys open for picking right now, for the Offer cards on Today (3.1 plan, Card
// kinds). Only what the shared link's own page shows anybody: the title, the description and where
// the group will meet. Never who voted, their picks or the count. The creator's id comes back only
// so Today can leave a survey off its creator's general list and show it under their own cards.
// Read only: a survey past its close time is left out here and closes when its link is next opened.

export type MutualTimeOpenEvent = {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  meetingPluginName: string;
  createdByUserId: string;
  // When picking opened: the open time, or when it was made when it opened at once.
  openedAtIso: string;
};

type Row = {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  meeting_plugin: MutualTimeMeetingPlugin;
  created_by_user_id: string;
  opened_at: Date;
};

const OPEN_NOW = `status = 'open' AND (opens_at IS NULL OR opens_at <= NOW()) AND (closes_at IS NULL OR closes_at > NOW())`;

function toEvent(row: Row): MutualTimeOpenEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    meetingPluginName: meetingPluginName(row.meeting_plugin),
    createdByUserId: row.created_by_user_id,
    openedAtIso: new Date(row.opened_at).toISOString(),
  };
}

const COLUMNS = `id::text AS id, slug, title, description, meeting_plugin, created_by_user_id, COALESCE(opens_at, created_at) AS opened_at`;

// Newest first. `createdBy` keeps only one creator's surveys; `notCreatedBy` leaves one creator's out.
export async function listOpenEvents(input: { limit: number; createdBy?: string; notCreatedBy?: string }): Promise<MutualTimeOpenEvent[]> {
  const result = await queryDb<Row>(
    `SELECT ${COLUMNS} FROM mutual_time_events
      WHERE ${OPEN_NOW}
        AND ($1::text IS NULL OR created_by_user_id = $1)
        AND ($2::text IS NULL OR created_by_user_id <> $2)
      ORDER BY COALESCE(opens_at, created_at) DESC
      LIMIT $3`,
    [input.createdBy ?? null, input.notCreatedBy ?? null, input.limit],
  );
  return result.rows.map(toEvent);
}

// One survey by id with whether it is open for picking now; null when there is none.
export async function getEventForToday(id: string): Promise<(MutualTimeOpenEvent & { open: boolean }) | null> {
  const result = await queryDb<Row & { open: boolean }>(`SELECT ${COLUMNS}, (${OPEN_NOW}) AS open FROM mutual_time_events WHERE id = $1::uuid`, [id]);
  const row = result.rows[0];
  return row ? { ...toEvent(row), open: row.open } : null;
}
