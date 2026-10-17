// Workforce-driven rare-skill snapshot.
//
// SkillsHunt rewards the Rare Skill bonus when a submitter includes a skill that belongs to a job
// title Workforce currently identifies as under-recruited. The mapping is: rare job title (Workforce,
// by id) → its active skills (Skills Taxonomy) → skill_name in the lookup. A job title is "rare" when
// its recruited count is strictly under 50% of its Workforce target.
//
// Rewritten 2026-08-27: the signal now comes from the live Workforce gap model through
// lib/shared/workforce-interface.ts (the sanctioned crossing point). The previous version read
// the workforce_profiles / workforce_occupations tables, which Workforce stopped writing when it
// became a live computed model — so the snapshot had been coming back empty. Because the live
// model's demand targets come from the population model, almost every occupation is
// under-recruited while the member base is small; the snapshot therefore keeps only the job titles
// with the largest gaps (SKILLS_HUNT_RARE_SKILL_SNAPSHOT_LIMIT) so "rare" stays a meaningful signal.
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
};

const RARE_SKILL_RECRUITED_THRESHOLD = 0.5;

// The job titles Workforce currently reads as most under-recruited, largest gap first, capped at
// SKILLS_HUNT_RARE_SKILL_SNAPSHOT_LIMIT. Keyed by job title id, so a title listed under more than
// one sector counts once.
async function rareJobTitleIds(): Promise<string[]> {
  const gaps = await fetchOccupationGapReport();
  const rare = gaps
    .filter((item) => item.target > 0 && item.recruited / item.target < RARE_SKILL_RECRUITED_THRESHOLD)
    .sort((a, b) => b.gap - a.gap);
  const ids: string[] = [];
  for (const item of rare) {
    if (!item.jobTitleId || ids.includes(item.jobTitleId)) continue;
    ids.push(item.jobTitleId);
    if (ids.length >= SKILLS_HUNT_RARE_SKILL_SNAPSHOT_LIMIT) break;
  }
  return ids;
}

// The rows of the round's rare-skill lookup: every active Skills Taxonomy skill under a rare job
// title (owner decision, 2026-10-17; issue #2870). Until then the lookup held the job title names
// themselves, and a nomination carries skill names, which almost never equal a job title name, so
// the bonus, the Rare Talent Scout badge and the rare-find missions almost never moved. A skill name
// shared by two rare titles appears once; the lookup keys on the lower-cased name.
async function computeWorkforceRareSkills(client: PoolClient): Promise<RareSkillSnapshotRow[]> {
  const jobTitleIds = await rareJobTitleIds();
  if (jobTitleIds.length === 0) return [];
  const skills = await client.query<{ name: string }>(
    `SELECT DISTINCT ON (lower(btrim(name))) name
       FROM skills_taxonomy_skills
      WHERE job_title_id = ANY($1::uuid[]) AND is_active = TRUE AND btrim(name) <> ''
      ORDER BY lower(btrim(name)), name`,
    [jobTitleIds],
  );
  return skills.rows.map((row) => ({ skillName: row.name, bonusPoints: SKILLS_HUNT_SCORE_WEIGHTS_SPEC.rareSkillBonus }));
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
