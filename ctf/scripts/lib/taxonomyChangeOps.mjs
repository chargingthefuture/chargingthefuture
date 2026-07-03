// The append-only, ordered change-ops list for the skills taxonomy, and its static validation.
//
// GOVERNANCE (owner decision 2026-07-03 — see ctf/docs/developer/SKILLS_TAXONOMY_CHANGE_GOVERNANCE_PLAN.md):
// the taxonomy (sector -> occupation/job title -> skill) is baseline data for Directory, Workforce,
// SkillsHunt, Foundation, LevelUp, and GDP. It is never edited one-off. Every change is an op
// appended to TAXONOMY_CHANGE_OPS below, reviewed in a PR, validated by CI
// (ctf/scripts/check-taxonomy-change-ops.mjs), and applied to the live database by the owner-run
// manual-dispatch workflow (.github/workflows/seed-skills-taxonomy.yml -> seedSkillsTaxonomy.mjs ->
// applyTaxonomyChangeOps.mjs).
//
// Rules that keep this safe:
// - APPEND ONLY. Never edit, delete, reorder, or renumber an op that has APPLIED to the live
//   database. To undo an applied change, append the reverse op (e.g. reactivateSkill after a
//   deactivateSkill). An op that has NEVER successfully applied (every run containing it failed and
//   rolled back) may be corrected in place via a reviewed PR — like an unapplied migration, editing
//   it cannot desync anything because it never took effect anywhere.
// - NO HARD DELETE. There is no delete op; deactivate (is_active = false) + reparent cover every
//   removal need and stay reversible. Member profile links point at the skill row id, so a
//   reparented skill keeps every member's profile intact.
// - SECTORS ARE FIXED. No op creates or deactivates a sector; a sector is always looked up by name
//   in the live database. A missing sector means the op is mis-named.
// - This list is the single repo write path to the taxonomy.
//
// Op vocabulary (all names are matched case-insensitively after whitespace normalization):
//
//   { id, op: 'addOccupation', sector, occupation }
//   { id, op: 'addSkill', sector, occupation, skill,
//     occupationExisting?: true,          // the occupation is a pre-existing live row, not created by an earlier op
//     proposalNormalizedSkills?: string[] // skills_hunt_proposed_skill_promotions labels this op fulfils
//   }
//   { id, op: 'renameOccupation', sector, from, to }
//   { id, op: 'renameSkill', sector, occupation, from, to, occupationExisting?: true }
//   { id, op: 'reparentSkill', skill, fromSector, fromOccupation, toSector, toOccupation,
//     fromOccupationExisting?: true, toOccupationExisting?: true }
//   { id, op: 'deactivateSkill', sector, occupation, skill, acknowledgedImpact,
//     occupationExisting?: true, skillExisting?: true }
//   { id, op: 'deactivateOccupation', sector, occupation, acknowledgedImpact, occupationExisting?: true }
//   { id, op: 'reactivateSkill', sector, occupation, skill, occupationExisting?: true, skillExisting?: true }
//   { id, op: 'reactivateOccupation', sector, occupation, occupationExisting?: true }
//
// 'acknowledgedImpact' is a mandatory human-written note on every deactivation stating the reviewed
// blast radius (how many member profiles reference the target, and why deactivating is right). The
// apply engine re-checks the live reference counts and aborts if the impact was never acknowledged.

import { normalizeTaxonomyName } from './taxonomyNames.mjs';

export const TAXONOMY_CHANGE_OP_TYPES = [
  'addOccupation',
  'addSkill',
  'renameOccupation',
  'renameSkill',
  'reparentSkill',
  'deactivateSkill',
  'deactivateOccupation',
  'reactivateSkill',
  'reactivateOccupation',
];

// ---------------------------------------------------------------------------
// The list. APPEND ONLY — see the header. Ids are 1-based and strictly sequential.
// ---------------------------------------------------------------------------
export const TAXONOMY_CHANGE_OPS = [
  // Ops 1-9: "Marketing Specialist" under "Professional & Business Services"
  // (fulfils the "Marketing" proposal, issue #681; owner-approved 2026-06-21).
  { id: 1, op: 'addOccupation', sector: 'Professional & Business Services', occupation: 'Marketing Specialist' },
  { id: 2, op: 'addSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialist', skill: 'Marketing', proposalNormalizedSkills: ['marketing'] },
  { id: 3, op: 'addSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialist', skill: 'Social Media Marketing' },
  { id: 4, op: 'addSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialist', skill: 'Content Marketing' },
  { id: 5, op: 'addSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialist', skill: 'Search Engine Optimization (SEO)' },
  { id: 6, op: 'addSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialist', skill: 'Email Marketing' },
  { id: 7, op: 'addSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialist', skill: 'Market Research' },
  { id: 8, op: 'addSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialist', skill: 'Brand Management' },
  { id: 9, op: 'addSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialist', skill: 'Copywriting' },

  // Ops 10-24: "Game Designers / Developers" under "Creative & Media"
  // (owner-approved 2026-06-25; no SkillsHunt proposal backs it).
  { id: 10, op: 'addOccupation', sector: 'Creative & Media', occupation: 'Game Designers / Developers' },
  { id: 11, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Game Design' },
  { id: 12, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Level Design' },
  { id: 13, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Narrative Design' },
  { id: 14, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Game Systems Design' },
  { id: 15, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Game Development' },
  { id: 16, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Gameplay Programming' },
  { id: 17, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Game Physics' },
  { id: 18, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Game AI Programming' },
  { id: 19, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Multiplayer Networking' },
  { id: 20, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Unity' },
  { id: 21, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Unreal Engine' },
  { id: 22, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Godot' },
  { id: 23, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Game Prototyping' },
  { id: 24, op: 'addSkill', sector: 'Creative & Media', occupation: 'Game Designers / Developers', skill: 'Playtesting & QA' },

  // Op 25: "Merchandising" joins the pre-existing "Supply Managers" occupation under
  // "Retail & Services" (skill proposal #1180; owner-approved 2026-06-29).
  { id: 25, op: 'addSkill', sector: 'Retail & Services', occupation: 'Supply Managers', skill: 'Merchandising', occupationExisting: true, proposalNormalizedSkills: ['merchandising'] },

  // Ops 26-34 (owner-approved 2026-07-03): merge the duplicate "Marketing Specialist" (singular,
  // created by op 1 — the exact-name occupation match missed the pre-existing plural row) into the
  // pre-existing "Marketing Specialists" (plural, matching the sector's plural naming convention).
  // All 8 skills move by reparent (member profile links follow the skill row ids, so nobody loses
  // a skill); the emptied singular is then deactivated. No name collisions: the plural's five
  // pre-existing skills (Market research and segmentation; Campaign planning (digital & offline);
  // Brand strategy and positioning; Content strategy and analytics; SEO/SEM and paid-media
  // management) share no exact name with the eight below.
  { id: 26, op: 'reparentSkill', skill: 'Marketing', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 27, op: 'reparentSkill', skill: 'Social Media Marketing', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 28, op: 'reparentSkill', skill: 'Content Marketing', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 29, op: 'reparentSkill', skill: 'Search Engine Optimization (SEO)', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 30, op: 'reparentSkill', skill: 'Email Marketing', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 31, op: 'reparentSkill', skill: 'Market Research', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 32, op: 'reparentSkill', skill: 'Brand Management', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 33, op: 'reparentSkill', skill: 'Copywriting', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 34, op: 'deactivateOccupation', sector: 'Professional & Business Services', occupation: 'Marketing Specialist', acknowledgedImpact: 'Duplicate of the pre-existing "Marketing Specialists" occupation; all 8 of its skills were reparented there by ops 26-33, so no skill rows remain under it and member profile links are untouched. The apply engine refuses this op if any active skill remains.' },

  // Ops 35-36 (owner-approved 2026-07-03): thin the near-duplicate skill pairs left by the op 26-34
  // merge. The owner picked the surviving label of each pair; the other is deactivated (reversible;
  // the audit row records the live member-holder count at apply time).
  { id: 35, op: 'deactivateSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialists', skill: 'Market Research', acknowledgedImpact: 'Near-duplicate of "Market research and segmentation", the owner-picked survivor of the pair. Members holding this row stop seeing the chip until they re-pick the surviving skill; the audit metadata records how many were holding it.' },
  { id: 36, op: 'deactivateSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialists', skill: 'SEO/SEM and paid-media management', skillExisting: true, acknowledgedImpact: 'Near-duplicate of "Search Engine Optimization (SEO)", the owner-picked survivor of the pair. Members holding this row stop seeing the chip until they re-pick the surviving skill; the audit metadata records how many were holding it.' },
];

// ---------------------------------------------------------------------------
// Static validation. Pure — no database. Replays the list against an in-memory
// registry and returns { valid, errors }. Every error names the offending op id.
// ---------------------------------------------------------------------------

function key(...parts) {
  return parts.map((part) => normalizeTaxonomyName(String(part ?? '')).toLowerCase()).join('|');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && normalizeTaxonomyName(value).length > 0;
}

export function validateTaxonomyChangeOps(ops = TAXONOMY_CHANGE_OPS) {
  const errors = [];
  const fail = (id, message) => errors.push(`op ${id}: ${message}`);

  if (!Array.isArray(ops)) {
    return { valid: false, errors: ['TAXONOMY_CHANGE_OPS is not an array.'] };
  }

  // Occupations: key(sector, occupation) -> { active }
  // Skills: key(sector, occupation, skill) -> { active }
  // Pre-existing live rows enter the registry via the *Existing flags.
  const occupations = new Map();
  const skills = new Map();

  const requireOccupation = (id, sector, occupation, existingFlag, label) => {
    const occKey = key(sector, occupation);
    if (!occupations.has(occKey)) {
      if (existingFlag === true) {
        occupations.set(occKey, { active: true });
      } else {
        fail(id, `${label} occupation "${occupation}" (${sector}) is not created by an earlier op; add an addOccupation op first or set the existing flag if it is a pre-existing live row.`);
        return null;
      }
    }
    const occ = occupations.get(occKey);
    if (!occ.active) {
      fail(id, `${label} occupation "${occupation}" (${sector}) was deactivated by an earlier op.`);
      return null;
    }
    return occKey;
  };

  ops.forEach((entry, index) => {
    const expectedId = index + 1;
    if (entry.id !== expectedId) {
      fail(entry.id ?? `#${index}`, `id must be ${expectedId} (ids are 1-based, strictly sequential, append-only).`);
    }
    const id = entry.id ?? `#${index}`;

    if (!TAXONOMY_CHANGE_OP_TYPES.includes(entry.op)) {
      fail(id, `unknown op type "${entry.op}".`);
      return;
    }

    switch (entry.op) {
      case 'addOccupation': {
        if (!isNonEmptyString(entry.sector) || !isNonEmptyString(entry.occupation)) {
          fail(id, 'addOccupation requires non-empty sector and occupation.');
          return;
        }
        const occKey = key(entry.sector, entry.occupation);
        if (occupations.has(occKey)) {
          fail(id, `occupation "${entry.occupation}" (${entry.sector}) is already created by an earlier op.`);
          return;
        }
        occupations.set(occKey, { active: true });
        return;
      }

      case 'addSkill': {
        if (!isNonEmptyString(entry.sector) || !isNonEmptyString(entry.occupation) || !isNonEmptyString(entry.skill)) {
          fail(id, 'addSkill requires non-empty sector, occupation, and skill.');
          return;
        }
        const occKey = requireOccupation(id, entry.sector, entry.occupation, entry.occupationExisting, 'target');
        if (!occKey) return;
        const skillKey = key(entry.sector, entry.occupation, entry.skill);
        if (skills.has(skillKey) && skills.get(skillKey).active) {
          fail(id, `skill "${entry.skill}" already exists under "${entry.occupation}" (${entry.sector}).`);
          return;
        }
        skills.set(skillKey, { active: true });
        return;
      }

      case 'renameOccupation': {
        if (!isNonEmptyString(entry.sector) || !isNonEmptyString(entry.from) || !isNonEmptyString(entry.to)) {
          fail(id, 'renameOccupation requires non-empty sector, from, and to.');
          return;
        }
        const fromKey = key(entry.sector, entry.from);
        const toKey = key(entry.sector, entry.to);
        if (occupations.has(toKey)) {
          fail(id, `rename target "${entry.to}" (${entry.sector}) already exists.`);
          return;
        }
        // A rename of a pre-existing live occupation is allowed without a flag: the from-row may
        // not be in the registry. Track it from here on under the new name.
        const state = occupations.get(fromKey) ?? { active: true };
        if (!state.active) {
          fail(id, `cannot rename deactivated occupation "${entry.from}" (${entry.sector}); reactivate it first.`);
          return;
        }
        occupations.delete(fromKey);
        occupations.set(toKey, state);
        return;
      }

      case 'renameSkill': {
        if (!isNonEmptyString(entry.sector) || !isNonEmptyString(entry.occupation) || !isNonEmptyString(entry.from) || !isNonEmptyString(entry.to)) {
          fail(id, 'renameSkill requires non-empty sector, occupation, from, and to.');
          return;
        }
        const occKey = requireOccupation(id, entry.sector, entry.occupation, entry.occupationExisting, 'target');
        if (!occKey) return;
        const fromKey = key(entry.sector, entry.occupation, entry.from);
        const toKey = key(entry.sector, entry.occupation, entry.to);
        if (skills.has(toKey) && skills.get(toKey).active) {
          fail(id, `rename target skill "${entry.to}" already exists under "${entry.occupation}" (${entry.sector}).`);
          return;
        }
        const state = skills.get(fromKey) ?? { active: true };
        if (!state.active) {
          fail(id, `cannot rename deactivated skill "${entry.from}"; reactivate it first.`);
          return;
        }
        skills.delete(fromKey);
        skills.set(toKey, state);
        return;
      }

      case 'reparentSkill': {
        if (!isNonEmptyString(entry.skill) || !isNonEmptyString(entry.fromSector) || !isNonEmptyString(entry.fromOccupation) || !isNonEmptyString(entry.toSector) || !isNonEmptyString(entry.toOccupation)) {
          fail(id, 'reparentSkill requires non-empty skill, fromSector, fromOccupation, toSector, and toOccupation.');
          return;
        }
        requireOccupation(id, entry.fromSector, entry.fromOccupation, entry.fromOccupationExisting, 'source');
        const toKey = requireOccupation(id, entry.toSector, entry.toOccupation, entry.toOccupationExisting, 'target');
        if (!toKey) return;
        const fromSkillKey = key(entry.fromSector, entry.fromOccupation, entry.skill);
        const toSkillKey = key(entry.toSector, entry.toOccupation, entry.skill);
        if (skills.has(toSkillKey) && skills.get(toSkillKey).active) {
          fail(id, `a skill named "${entry.skill}" already exists under "${entry.toOccupation}" (${entry.toSector}); a reparent cannot merge rows.`);
          return;
        }
        const state = skills.get(fromSkillKey) ?? { active: true };
        if (!state.active) {
          fail(id, `cannot reparent deactivated skill "${entry.skill}"; reactivate it first.`);
          return;
        }
        skills.delete(fromSkillKey);
        skills.set(toSkillKey, state);
        return;
      }

      case 'deactivateSkill': {
        if (!isNonEmptyString(entry.sector) || !isNonEmptyString(entry.occupation) || !isNonEmptyString(entry.skill)) {
          fail(id, 'deactivateSkill requires non-empty sector, occupation, and skill.');
          return;
        }
        if (!isNonEmptyString(entry.acknowledgedImpact)) {
          fail(id, 'deactivateSkill requires a non-empty acknowledgedImpact note (the reviewed blast radius).');
          return;
        }
        const occKey = requireOccupation(id, entry.sector, entry.occupation, entry.occupationExisting, 'target');
        if (!occKey) return;
        const skillKey = key(entry.sector, entry.occupation, entry.skill);
        if (!skills.has(skillKey) && entry.skillExisting !== true) {
          fail(id, `skill "${entry.skill}" is not created by an earlier op; set skillExisting: true if it is a pre-existing live row.`);
          return;
        }
        const state = skills.get(skillKey) ?? { active: true };
        if (!state.active) {
          fail(id, `skill "${entry.skill}" is already deactivated by an earlier op.`);
          return;
        }
        state.active = false;
        skills.set(skillKey, state);
        return;
      }

      case 'deactivateOccupation': {
        if (!isNonEmptyString(entry.sector) || !isNonEmptyString(entry.occupation)) {
          fail(id, 'deactivateOccupation requires non-empty sector and occupation.');
          return;
        }
        if (!isNonEmptyString(entry.acknowledgedImpact)) {
          fail(id, 'deactivateOccupation requires a non-empty acknowledgedImpact note (the reviewed blast radius).');
          return;
        }
        const occKey = key(entry.sector, entry.occupation);
        if (!occupations.has(occKey) && entry.occupationExisting !== true) {
          fail(id, `occupation "${entry.occupation}" (${entry.sector}) is not created by an earlier op; set occupationExisting: true if it is a pre-existing live row.`);
          return;
        }
        const state = occupations.get(occKey) ?? { active: true };
        if (!state.active) {
          fail(id, `occupation "${entry.occupation}" (${entry.sector}) is already deactivated by an earlier op.`);
          return;
        }
        state.active = false;
        occupations.set(occKey, state);
        return;
      }

      case 'reactivateSkill': {
        if (!isNonEmptyString(entry.sector) || !isNonEmptyString(entry.occupation) || !isNonEmptyString(entry.skill)) {
          fail(id, 'reactivateSkill requires non-empty sector, occupation, and skill.');
          return;
        }
        const occKey = requireOccupation(id, entry.sector, entry.occupation, entry.occupationExisting, 'target');
        if (!occKey) return;
        const skillKey = key(entry.sector, entry.occupation, entry.skill);
        if (!skills.has(skillKey) && entry.skillExisting !== true) {
          fail(id, `skill "${entry.skill}" is not known to earlier ops; set skillExisting: true if it is a pre-existing live row.`);
          return;
        }
        const state = skills.get(skillKey) ?? { active: false };
        state.active = true;
        skills.set(skillKey, state);
        return;
      }

      case 'reactivateOccupation': {
        if (!isNonEmptyString(entry.sector) || !isNonEmptyString(entry.occupation)) {
          fail(id, 'reactivateOccupation requires non-empty sector and occupation.');
          return;
        }
        const occKey = key(entry.sector, entry.occupation);
        if (!occupations.has(occKey) && entry.occupationExisting !== true) {
          fail(id, `occupation "${entry.occupation}" (${entry.sector}) is not known to earlier ops; set occupationExisting: true if it is a pre-existing live row.`);
          return;
        }
        const state = occupations.get(occKey) ?? { active: false };
        state.active = true;
        occupations.set(occKey, state);
        return;
      }

      default:
        fail(id, `unhandled op type "${entry.op}".`);
    }
  });

  return { valid: errors.length === 0, errors };
}
