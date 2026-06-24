// Workforce-driven rare-skill snapshot.
//
// SkillsHunt rewards the Rare Skill bonus when a submitter includes a skill
// that Workforce currently identifies as under-recruited. The mapping is:
// occupation_name (Workforce) → skill_name (SkillsHunt taxonomy / free-text).
// An occupation is considered "rare" when its recruited share is strictly
// under 50% of the profiles attached to it.
//
// snapshotRareSkillsForRound() is called from the admin POST /admin/rounds
// route at round-create time. It atomically deletes any pre-existing
// snapshot for the round and inserts a fresh one. We deliberately do NOT
// recompute on every submission — the spec says "live snapshot at
// round-create", which keeps scoring deterministic for the duration of a
// round.

import type { PoolClient } from 'pg';
import { SKILLS_HUNT_SCORE_WEIGHTS_SPEC } from './constants';

export type RareSkillSnapshotRow = {
  skillName: string;
  bonusPoints: number;
  totalProfiles: number;
  recruitedProfiles: number;
};

const RARE_SKILL_RECRUITED_THRESHOLD = 0.5;

export async function computeWorkforceRareSkills(client: PoolClient): Promise<RareSkillSnapshotRow[]> {
  // Group all workforce_profiles by occupation, compute share recruited,
  // emit rows where share < 0.5. Active occupations only.
  const result = await client.query<{
    skill_name: string;
    total_profiles: string;
    recruited_profiles: string;
  }>(
    `
      SELECT
        o.name AS skill_name,
        COUNT(*)::text AS total_profiles,
        COUNT(*) FILTER (WHERE p.recruited_state = TRUE)::text AS recruited_profiles
      FROM workforce_profiles p
      JOIN workforce_occupations o ON o.id = p.occupation_id
      WHERE o.is_active = TRUE
      GROUP BY o.name
      HAVING COUNT(*) > 0
         AND (COUNT(*) FILTER (WHERE p.recruited_state = TRUE))::numeric / COUNT(*)::numeric < $1
    `,
    [RARE_SKILL_RECRUITED_THRESHOLD],
  );

  return result.rows.map((row) => ({
    skillName: row.skill_name,
    bonusPoints: SKILLS_HUNT_SCORE_WEIGHTS_SPEC.rareSkillBonus,
    totalProfiles: Number.parseInt(row.total_profiles, 10),
    recruitedProfiles: Number.parseInt(row.recruited_profiles, 10),
  }));
}

export async function snapshotRareSkillsForRound(
  client: PoolClient,
  roundId: string,
): Promise<{ snapshotted: number }> {
  const rows = await computeWorkforceRareSkills(client);

  await client.query(`DELETE FROM skills_hunt_rare_skills_lookup WHERE round_id = $1::uuid`, [roundId]);

  if (rows.length === 0) {
    return { snapshotted: 0 };
  }

  // Bulk insert via UNNEST for one round-trip regardless of row count.
  const skillNames = rows.map((r) => r.skillName);
  const bonusPoints = rows.map((r) => r.bonusPoints);

  await client.query(
    `
      INSERT INTO skills_hunt_rare_skills_lookup (round_id, skill_name, bonus_points)
      SELECT $1::uuid, name, bonus
      FROM UNNEST($2::text[], $3::int[]) AS t(name, bonus)
      ON CONFLICT (round_id, skill_name) DO UPDATE SET bonus_points = EXCLUDED.bonus_points
    `,
    [roundId, skillNames, bonusPoints],
  );

  return { snapshotted: rows.length };
}
