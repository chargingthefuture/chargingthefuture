import type { SeMute, SeMuteKind } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';

// Personal mute: a member's own list of muted people, posts and words. Read by Today to leave cards
// out, by Chyme rooms (through GET /api/account/mutes) to stop playing a muted person, and by a
// Today card's conversation before it tells a member something in Activity (`hasMutedPost`).
// Nobody is told; nothing else reads it.

export const MAX_MUTES = 100;
export const MAX_MUTE_WORDS_LENGTH = 60;

type MuteRow = { id: string; kind: SeMuteKind; target: string; label: string | null; created_at: Date };

export class MuteLimitError extends Error {
  constructor() {
    super(`A member can mute at most ${MAX_MUTES} people, posts and words.`);
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

export async function addMute(userId: string, kind: SeMuteKind, target: string, label: string | null): Promise<SeMute> {
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

// Whether this member muted this Today card: a muted card's conversation tells them nothing.
export async function hasMutedPost(userId: string, cardId: string): Promise<boolean> {
  const result = await queryDb<{ found: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM member_mutes WHERE user_id = $1 AND kind = 'post' AND target = $2) AS found`,
    [userId, cardId],
  );
  return result.rows[0]?.found === true;
}
