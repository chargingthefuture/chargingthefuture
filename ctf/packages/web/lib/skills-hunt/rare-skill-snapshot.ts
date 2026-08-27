// Workforce-driven rare-skill snapshot.
//
// SkillsHunt rewards the Rare Skill bonus when a submitter includes a skill that Workforce
// currently identifies as under-recruited. The mapping is: occupation name (Workforce) →
// skill_name (SkillsHunt taxonomy / free-text). An occupation is "rare" when its recruited
// count is strictly under 50% of its Workforce target.
//
// Rewritten 2026-08-27: the signal now comes from the live Workforce gap model through
// lib/shared/workforce-interface.ts (the sanctioned crossing point). The previous version read
// the workforce_profiles / workforce_occupations tables, which Workforce stopped writing when it
// became a live computed model — so the snapshot had been coming back empty. Because the live
// model's demand targets come from the population model, almost every occupation is
// under-recruited while the member base is small; the snapshot therefore keeps only the
// occupations with the largest gaps (SKILLS_HUNT_RARE_SKILL_SNAPSHOT_LIMIT) so "rare" stays a
// meaningful signal.
//
// snapshotRareSkillsForRound() is called from createRound at round-create time. It atomically
// deletes any pre-existing snapshot for the round and inserts a fresh one. We deliberately do
// NOT recompute on every submission — the spec says "live snapshot at round-create", which keeps
// scoring deterministic for the duration of a round.

import type { PoolClient } from 'pg';
import { fetchOccupationGapReport } from 'lib/shared/workforce-interface';
import {
  SKILLS_HUNT_RARE_SKILL_SNAPSHOT_LIMIT,
  SKILLS_HUNT_SCORE_WEIGHTS_SPEC,
} from './constants';

type RareSkillSnapshotRow = {
  skillName: string;
  bonusPoints: number;
  target: number;
  recruited: number;
  gap: number;
};

const RARE_SKILL_RECRUITED_THRESHOLD = 0.5;

async function computeWorkforceRareSkills(): Promise<RareSkillSnapshotRow[]> {
  const gaps = await fetchOccupationGapReport();
  const rare = gaps
    .filter((item) => item.target > 0 && item.recruited / item.target < RARE_SKILL_RECRUITED_THRESHOLD)
    .sort((a, b) => b.gap - a.gap);

  // The same occupation name can appear under more than one sector; the lookup keys on
  // skill_name, so keep only the first (largest-gap) row per name.
  const seen = new Set<string>();
  const rows: RareSkillSnapshotRow[] = [];
  for (const item of rare) {
    const key = item.occupation.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    rows.push({
      skillName: item.occupation,
      bonusPoints: SKILLS_HUNT_SCORE_WEIGHTS_SPEC.rareSkillBonus,
      target: item.target,
      recruited: item.recruited,
      gap: item.gap,
    });
    if (rows.length >= SKILLS_HUNT_RARE_SKILL_SNAPSHOT_LIMIT) {
      break;
    }
  }
  return rows;
}

export async function snapshotRareSkillsForRound(
  client: PoolClient,
  roundId: string,
): Promise<{ snapshotted: number }> {
  const rows = await computeWorkforceRareSkills();

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
