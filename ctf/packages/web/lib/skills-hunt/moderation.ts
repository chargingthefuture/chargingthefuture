// SkillsHunt — GDPR-style profile delete.
//
// A user can soft-delete every submission they authored. Audit log rows are
// explicitly preserved (regulatory retention). Directory profiles auto-generated
// from those submissions are NOT modified here — the Directory plugin owns its
// own deletion path, including the takedown that removes a community-generated
// profile at the person's request and blocks its Quora URL from being re-listed.
// SkillsHunt nulls the link by ON DELETE SET NULL where it can.

import type { PoolClient } from 'pg';

// GDPR soft-delete: marks every submission authored by the user as deleted,
// then recomputes derived state in the same transaction:
//   - Leaderboard rebuild for every affected round so the user disappears
//     from rankings immediately.
//   - Mission progress recompute for every affected round so completed
//     missions reflect the deletion (and may roll back to incomplete).
// Audit log entries are preserved (regulatory).
export async function softDeleteUserSubmissions(
  client: PoolClient,
  userId: string,
  // Optional recompute hooks injected by the caller so this module stays
  // free of import cycles with repository.ts / missions.ts. Both default to
  // no-ops; the route handler wires the real implementations.
  hooks: {
    rebuildLeaderboard?: (client: PoolClient, roundId: string) => Promise<void>;
    recomputeMissions?: (client: PoolClient, roundId: string, userId: string) => Promise<unknown>;
  } = {},
): Promise<{ deleted: number; rebuiltRounds: number }> {
  // Capture which rounds will be affected BEFORE the UPDATE; we re-read
  // the affected rounds after the soft-delete so the leaderboard rebuild
  // honors the new deleted_at filter.
  const affectedRounds = await client.query<{ round_id: string }>(
    `SELECT DISTINCT round_id FROM skills_hunt_submissions
     WHERE submitter_user_id = $1 AND deleted_at IS NULL`,
    [userId],
  );

  const result = await client.query(
    `
      UPDATE skills_hunt_submissions
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE submitter_user_id = $1 AND deleted_at IS NULL
    `,
    [userId],
  );

  let rebuilt = 0;
  for (const row of affectedRounds.rows) {
    if (hooks.rebuildLeaderboard) {
      await hooks.rebuildLeaderboard(client, row.round_id);
      rebuilt += 1;
    }
    if (hooks.recomputeMissions) {
      await hooks.recomputeMissions(client, row.round_id, userId);
    }
  }

  return { deleted: result.rowCount ?? 0, rebuiltRounds: rebuilt };
}
