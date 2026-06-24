// Idempotent promotion of curated, owner-approved free-text skills into the
// canonical skills taxonomy (sector -> occupation/job title -> skill).
//
// Background: the taxonomy is normally synced from the legacy platform dataset by
// syncSkillsTaxonomyFromLegacy.mjs. Free-text skills nominated through SkillsHunt
// that are not yet in the taxonomy are tracked in skills_hunt_proposed_skill_promotions
// and surfaced as GitHub "skill proposal" issues by proposeSkillPromotions.mjs. When the
// owner approves a proposal, the skill must be added to the taxonomy in a durable,
// repeatable way so that every reseed keeps it. This module is that durable home.
//
// It mirrors the upsert helpers in syncSkillsTaxonomyFromLegacy.mjs:
//   - look up the sector by name (it must already exist; this never creates sectors)
//   - upsert the occupation (job title) under that sector
//   - upsert each skill under that occupation
// Every write is ON CONFLICT no-op on re-run, so running it repeatedly is safe.
//
// It also marks the matching skills_hunt_proposed_skill_promotions row as 'promoted'
// (by normalized skill label) when present, so the proposal tracker reflects reality.
//
// The promotions list below is the single source of truth for owner-approved promotions.
// Add a new approved promotion by appending an entry; keep it small and curated.

import { normalizeTaxonomyName } from './loadLegacySkillsData.mjs';

// Curated, owner-approved promotions. Each entry names an EXISTING sector (looked up by
// name, never created), one occupation to upsert under it, and the skills to upsert under
// that occupation. proposalNormalizedSkills lists the normalized (trim+lowercase) labels of
// any skills_hunt_proposed_skill_promotions rows this promotion fulfils, so they can be
// marked 'promoted'.
export const APPROVED_SKILL_PROMOTIONS = [
  {
    sectorName: 'Professional & Business Services',
    occupationName: 'Marketing Specialist',
    skills: [
      'Marketing',
      'Social Media Marketing',
      'Content Marketing',
      'Search Engine Optimization (SEO)',
      'Email Marketing',
      'Market Research',
      'Brand Management',
      'Copywriting',
    ],
    proposalNormalizedSkills: ['marketing'],
  },
];

async function findSectorIdByName(client, sectorName) {
  const result = await client.query(
    `SELECT id FROM skills_taxonomy_sectors WHERE lower(name) = lower($1) LIMIT 1`,
    [sectorName],
  );
  return result.rows[0]?.id ?? null;
}

async function upsertJobTitle(client, sectorId, name, displayOrder) {
  const result = await client.query(
    `
      INSERT INTO skills_taxonomy_job_titles (sector_id, name, display_order, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (sector_id, (lower(name)))
      DO UPDATE SET
        is_active = true,
        updated_at = NOW()
      RETURNING id
    `,
    [sectorId, name, displayOrder],
  );
  return result.rows[0].id;
}

async function upsertSkill(client, jobTitleId, name, displayOrder) {
  const result = await client.query(
    `
      INSERT INTO skills_taxonomy_skills (job_title_id, name, display_order, aliases, is_active)
      VALUES ($1, $2, $3, '[]'::jsonb, true)
      ON CONFLICT (job_title_id, (lower(name)))
      DO UPDATE SET
        is_active = true,
        updated_at = NOW()
      RETURNING id
    `,
    [jobTitleId, name, displayOrder],
  );
  return result.rows[0].id;
}

async function markProposalsPromoted(client, normalizedSkills) {
  if (!normalizedSkills || normalizedSkills.length === 0) {
    return 0;
  }
  const result = await client.query(
    `
      UPDATE skills_hunt_proposed_skill_promotions
      SET status = 'promoted', updated_at = NOW()
      WHERE lower(btrim(normalized_skill)) = ANY($1::text[])
        AND status <> 'promoted'
    `,
    [normalizedSkills.map((value) => value.trim().toLowerCase())],
  );
  return result.rowCount ?? 0;
}

// Apply every curated promotion in one transaction. Idempotent: re-running no-ops.
// Returns a summary of what was touched.
export async function seedSkillsTaxonomyPromotions({ pool, promotions = APPROVED_SKILL_PROMOTIONS } = {}) {
  if (!pool) {
    throw new Error('pool is required.');
  }

  const summary = {
    occupations: 0,
    skills: 0,
    proposalsMarkedPromoted: 0,
    missingSectors: [],
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const promotion of promotions) {
      const sectorName = normalizeTaxonomyName(promotion.sectorName);
      const occupationName = normalizeTaxonomyName(promotion.occupationName);
      if (sectorName.length === 0 || occupationName.length === 0) {
        continue;
      }

      const sectorId = await findSectorIdByName(client, sectorName);
      if (!sectorId) {
        // Never create a sector. A missing sector means the curated promotion is
        // mis-named; record it and skip rather than guessing.
        summary.missingSectors.push(sectorName);
        continue;
      }

      const jobTitleId = await upsertJobTitle(client, sectorId, occupationName, 0);
      summary.occupations += 1;

      const skills = Array.isArray(promotion.skills) ? promotion.skills : [];
      for (let index = 0; index < skills.length; index += 1) {
        const skillName = normalizeTaxonomyName(skills[index]);
        if (skillName.length === 0) {
          continue;
        }
        await upsertSkill(client, jobTitleId, skillName, index + 1);
        summary.skills += 1;
      }

      summary.proposalsMarkedPromoted += await markProposalsPromoted(
        client,
        promotion.proposalNormalizedSkills,
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return summary;
}
