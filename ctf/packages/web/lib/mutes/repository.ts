import type { SeMute } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';

// Personal mute: a member's own list of muted people and words. Read by Today to leave cards out, and
// by Chyme rooms (through GET /api/account/mutes) to stop playing a muted person.
// Nobody is told; nothing else reads it.

export const MAX_MUTES = 100;
export const MAX_MUTE_WORDS_LENGTH = 60;

type MuteRow = { id: string; kind: 'person' | 'words'; target: string; label: string | null; created_at: Date };

export class MuteLimitError extends Error {
  constructor() {
    super(`A member can mute at most ${MAX_MUTES} people and words.`);
  }
}

function toMute(row: MuteRow): SeMute {
  return { id: row.id, kind: row.kind, target: row.target, label: row.label, createdAtIso: new Date(row.created_at).toISOString() };
}

export async function listMutes(userId: string): Promise<SeMute[]> {
  const result = await queryDb<MuteRow>(
    `SELECT id, kind, target, label, created_at FROM member_mutes WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows.map(toMute);
}

export async function addMute(userId: string, kind: 'person' | 'words', target: string, label: string | null): Promise<SeMute> {
  const count = await queryDb<{ n: number }>(`SELECT COUNT(*)::int AS n FROM member_mutes WHERE user_id = $1`, [userId]);
  if ((count.rows[0]?.n ?? 0) >= MAX_MUTES) throw new MuteLimitError();
  const result = await queryDb<MuteRow>(
    `INSERT INTO member_mutes (user_id, kind, target, label)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, kind, target) DO UPDATE SET label = COALESCE(EXCLUDED.label, member_mutes.label)
     RETURNING id, kind, target, label, created_at`,
    [userId, kind, target, label],
  );
  return toMute(result.rows[0]);
}

export async function removeMute(userId: string, muteId: string): Promise<boolean> {
  const result = await queryDb(`DELETE FROM member_mutes WHERE id = $1 AND user_id = $2`, [muteId, userId]);
  return (result.rowCount ?? 0) > 0;
}
