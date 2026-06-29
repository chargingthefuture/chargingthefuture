// Idempotent promotion of curated, owner-approved free-text skills into the
// canonical skills taxonomy (sector -> occupation/job title -> skill).
//
// Source of truth: the LIVE database taxonomy (`skills_taxonomy_sectors` / `_job_titles` /
// `_skills`). The old legacy platform dataset and its sync are gone (removed with the legacy app);
// do not look for or rebuild them. This curated list is the durable, repeatable way owner-approved
// skills are added to the live taxonomy — append here and run the seed (`seedSkillsTaxonomy.mjs`);
// the sector is looked up by name in the live DB (never created) and the occupation/skill are
// upserted under it.
//
// Background: free-text skills nominated through SkillsHunt that are not yet in the taxonomy are
// tracked in skills_hunt_proposed_skill_promotions and surfaced as GitHub "skill proposal" issues by
// proposeSkillPromotions.mjs. When the owner approves a proposal, the skill must be added to the
// taxonomy in a durable, repeatable way so that every reseed keeps it. This module is that durable
// home, and the only path that writes the taxonomy from the seeds.
//
// Each entry is applied by:
//   - look up the sector by name (it must already exist in the live DB; this never creates sectors)
//   - upsert the occupation (job title) under that sector
//   - upsert each skill under that occupation
// Every write is ON CONFLICT no-op on re-run, so running it repeatedly is safe.
//
// It also marks the matching proposal rows as 'promoted' (by normalized skill label) when
// present, so the trackers reflect reality: both the cross-app skills_hunt_proposed_skill_promotions
// intake and any directory_profile_proposed_skills row a member added through the Directory
// "skill not listed" box. For the Directory rows it additionally auto-attaches the now-official
// taxonomy skill to each proposing member's profile (directory_profile_skills), so the member's
// "pending review" chip becomes the real taxonomy chip instead of disappearing.
//
// The promotions list below is the single source of truth for owner-approved promotions.
// Add a new approved promotion by appending an entry; keep it small and curated.

import { normalizeTaxonomyName } from './taxonomyNames.mjs';

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
  {
    sectorName: 'Creative & Media',
    occupationName: 'Game Designers / Developers',
    skills: [
      'Game Design',
      'Level Design',
      'Narrative Design',
      'Game Systems Design',
      'Game Development',
      'Gameplay Programming',
      'Game Physics',
      'Game AI Programming',
      'Multiplayer Networking',
      'Unity',
      'Unreal Engine',
      'Godot',
      'Game Prototyping',
      'Playtesting & QA',
    ],
    proposalNormalizedSkills: [],
  },
  {
    // Approved from skill proposal #1180 (SkillsHunt nomination). "Supply Managers" under
    // "Retail & Services" already exists in the live taxonomy with skills Inventory control,
    // Supplier negotiation, and Demand forecasting; Merchandising joins them.
    sectorName: 'Retail & Services',
    occupationName: 'Supply Managers',
    skills: [
      'Merchandising',
    ],
    proposalNormalizedSkills: ['merchandising'],
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

// Resolve member-added Directory "skill not listed" entries once the same label is promoted
// into the taxonomy under jobTitleId. Two steps, in order:
//   1. Auto-attach: every profile that proposed this label is given the now-official taxonomy
//      skill (insert into directory_profile_skills), so the member keeps it as a real chip
//      instead of losing it and having to re-pick it. Idempotent (ON CONFLICT DO NOTHING) and
//      one-shot (only pending rows attach), so a member who later removes the skill is respected.
//   2. Mark promoted: flip the matching directory_profile_proposed_skills rows to 'promoted' so
//      they drop out of the profile's pending set (loadProfileProposedSkills reads status =
//      'pending') and the muted "pending review" chip is replaced by the real one.
// The attach is scoped to jobTitleId (the occupation this promotion added the skill under) so a
// proposal label resolves to the specific skill just promoted, not a same-named skill elsewhere.
async function promoteDirectoryProposals(client, jobTitleId, normalizedSkills) {
  if (!normalizedSkills || normalizedSkills.length === 0) {
    return { attached: 0, marked: 0 };
  }
  const labels = normalizedSkills.map((value) => value.trim().toLowerCase());

  const attachResult = await client.query(
    `
      INSERT INTO directory_profile_skills (profile_id, skill_id, display_order)
      SELECT
        d.profile_id,
        sk.id,
        COALESCE(
          (SELECT MAX(x.display_order) FROM directory_profile_skills x WHERE x.profile_id = d.profile_id),
          0
        ) + 1
      FROM directory_profile_proposed_skills d
      JOIN skills_taxonomy_skills sk
        ON sk.job_title_id = $1
       AND lower(btrim(sk.name)) = lower(btrim(d.skill_label))
       AND sk.is_active = true
      WHERE d.status = 'pending'
        AND lower(btrim(d.skill_label)) = ANY($2::text[])
      ON CONFLICT (profile_id, skill_id) DO NOTHING
    `,
    [jobTitleId, labels],
  );

  const markResult = await client.query(
    `
      UPDATE directory_profile_proposed_skills
      SET status = 'promoted', updated_at = NOW()
      WHERE status <> 'promoted'
        AND lower(btrim(skill_label)) = ANY($1::text[])
    `,
    [labels],
  );

  return { attached: attachResult.rowCount ?? 0, marked: markResult.rowCount ?? 0 };
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
    directoryProposalsMarkedPromoted: 0,
    directorySkillsAutoAttached: 0,
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
      const directoryPromotion = await promoteDirectoryProposals(
        client,
        jobTitleId,
        promotion.proposalNormalizedSkills,
      );
      summary.directoryProposalsMarkedPromoted += directoryPromotion.marked;
      summary.directorySkillsAutoAttached += directoryPromotion.attached;
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
