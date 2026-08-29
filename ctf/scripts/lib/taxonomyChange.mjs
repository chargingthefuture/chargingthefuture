// The append-only, ordered change list for the skills taxonomy, and its static validation.
//
// GOVERNANCE (owner decision 2026-07-03 — see ctf/docs/developer/SKILLS_TAXONOMY_CHANGE_GOVERNANCE_PLAN.md):
// the taxonomy (sector -> occupation/job title -> skill) is baseline data for Directory, Workforce,
// SkillsHunt, Foundation, SkillUp, and GDP. It is never edited one-off. Every change is an entry
// appended to TAXONOMY_CHANGES below, reviewed in a PR, validated by CI
// (ctf/scripts/check-taxonomy-change.mjs), and applied to the live database by the owner-run
// workflow (started by hand) (.github/workflows/seed-skills-taxonomy.yml -> seedSkillsTaxonomy.mjs ->
// applyTaxonomyChange.mjs).
//
// Rules that keep this safe:
// - APPEND ONLY. Never edit, delete, reorder, or renumber an entry that has APPLIED to the live
//   database. To undo an applied change, append the reverse change (e.g. reactivateSkill after a
//   deactivateSkill). An entry that has NEVER successfully applied (every run containing it failed and
//   rolled back) may be corrected in place via a reviewed PR — like an unapplied migration, editing
//   it cannot desync anything because it never took effect anywhere.
// - NO HARD DELETE. There is no delete change type; deactivate (is_active = false) + reparent cover every
//   removal need and stay reversible. Member profile links point at the skill row id, so a
//   reparented skill keeps every member's profile intact.
// - SECTORS ARE FIXED. No change creates or deactivates a sector; a sector is always looked up by name
//   in the live database. A missing sector means the entry is mis-named.
// - This list is the single repo write path to the taxonomy.
//
// Change vocabulary — the `op` field of each entry names the change type (all names are matched case-insensitively after whitespace normalization):
//
//   { id, op: 'addOccupation', sector, occupation }
//   { id, op: 'addSkill', sector, occupation, skill,
//     occupationExisting?: true,          // the occupation is a pre-existing live row, not created by an earlier entry
//     proposalNormalizedSkills?: string[] // skills_hunt_proposed_skill_promotions labels this change fulfils
//   }
//   { id, op: 'renameOccupation', sector, from, to }
//   { id, op: 'renameSkill', sector, occupation, from, to, occupationExisting?: true }
//   { id, op: 'reparentSkill', skill, fromSector, fromOccupation, toSector, toOccupation,
//     fromOccupationExisting?: true, toOccupationExisting?: true }
//   { id, op: 'consolidateSkill', skill, fromSector, fromOccupation, toSector, toOccupation,
//     fromOccupationExisting?: true, toOccupationExisting?: true }
//     -- merge-aware move: if the target occupation already has a same-named row, the source copy is
//        deactivated and the target row reactivated if needed (absorb); otherwise the source row is
//        reparented. Use for occupation merges where the target's holdings are not known in advance;
//        plain reparentSkill still refuses a collision.
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

export const TAXONOMY_CHANGE_TYPES = [
  'addOccupation',
  'addSkill',
  'renameOccupation',
  'renameSkill',
  'reparentSkill',
  'consolidateSkill',
  'deactivateSkill',
  'deactivateOccupation',
  'reactivateSkill',
  'reactivateOccupation',
];

// ---------------------------------------------------------------------------
// The list. APPEND ONLY — see the header. Ids are 1-based and strictly sequential.
// ---------------------------------------------------------------------------
export const TAXONOMY_CHANGES = [
  // Changes 1-9: "Marketing Specialist" under "Professional & Business Services"
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

  // Changes 10-24: "Game Designers / Developers" under "Creative & Media"
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

  // Change 25: "Merchandising" joins the pre-existing "Supply Managers" occupation under
  // "Retail & Services" (skill proposal #1180; owner-approved 2026-06-29).
  { id: 25, op: 'addSkill', sector: 'Retail & Services', occupation: 'Supply Managers', skill: 'Merchandising', occupationExisting: true, proposalNormalizedSkills: ['merchandising'] },

  // Changes 26-34 (owner-approved 2026-07-03): merge the duplicate "Marketing Specialist" (singular,
  // created by change 1 — the exact-name occupation match missed the pre-existing plural row) into the
  // pre-existing "Marketing Specialists" (plural, matching the sector's plural naming convention).
  // The emptied singular is then deactivated. Changes 26-33 were corrected (2026-07-03, never applied —
  // every run containing them rolled back) from reparentSkill to consolidateSkill: the live plural
  // gained a same-named "Marketing" row after these entries were authored (admin Add Skill), a reparent
  // refuses to merge rows by design, and consolidateSkill produces the right end state whichever of
  // the eight names the plural now carries — absorb where a name exists at the target, reparent
  // where it does not.
  { id: 26, op: 'consolidateSkill', skill: 'Marketing', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 27, op: 'consolidateSkill', skill: 'Social Media Marketing', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 28, op: 'consolidateSkill', skill: 'Content Marketing', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 29, op: 'consolidateSkill', skill: 'Search Engine Optimization (SEO)', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 30, op: 'consolidateSkill', skill: 'Email Marketing', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 31, op: 'consolidateSkill', skill: 'Market Research', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 32, op: 'consolidateSkill', skill: 'Brand Management', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 33, op: 'consolidateSkill', skill: 'Copywriting', fromSector: 'Professional & Business Services', fromOccupation: 'Marketing Specialist', toSector: 'Professional & Business Services', toOccupation: 'Marketing Specialists', toOccupationExisting: true },
  { id: 34, op: 'deactivateOccupation', sector: 'Professional & Business Services', occupation: 'Marketing Specialist', acknowledgedImpact: 'Duplicate of the pre-existing "Marketing Specialists" occupation; all 8 of its skills were reparented there by ops 26-33, so no skill rows remain under it and member profile links are untouched. The apply engine refuses this op if any active skill remains.' },

  // Changes 35-36 (owner-approved 2026-07-03): thin the near-duplicate skill pairs left by the 26-34
  // merge. The owner picked the surviving label of each pair; the other is deactivated (reversible;
  // the audit row records the live member-holder count at apply time).
  { id: 35, op: 'deactivateSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialists', skill: 'Market Research', acknowledgedImpact: 'Near-duplicate of "Market research and segmentation", the owner-picked survivor of the pair. Members holding this row stop seeing the chip until they re-pick the surviving skill; the audit metadata records how many were holding it.' },
  { id: 36, op: 'deactivateSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialists', skill: 'SEO/SEM and paid-media management', skillExisting: true, acknowledgedImpact: 'Near-duplicate of "Search Engine Optimization (SEO)", the owner-picked survivor of the pair. Members holding this row stop seeing the chip until they re-pick the surviving skill; the audit metadata records how many were holding it.' },

  // Changes 37-38 (owner-approved 2026-07-03): thin the last two near-duplicate pairs left by the
  // Marketing Specialists merge. The owner picked the survivors: "Content strategy and analytics"
  // (change 37 deactivates "Content Marketing") and "Brand Management" (change 38 deactivates "Brand
  // strategy and positioning"). Reversible; each audit row records the live member-holder count.
  { id: 37, op: 'deactivateSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialists', skill: 'Content Marketing', skillExisting: true, acknowledgedImpact: 'Near-duplicate of "Content strategy and analytics", the owner-picked survivor of the pair. Members holding this row stop seeing the chip until they re-pick the surviving skill; the audit metadata records how many were holding it.' },
  { id: 38, op: 'deactivateSkill', sector: 'Professional & Business Services', occupation: 'Marketing Specialists', skill: 'Brand strategy and positioning', skillExisting: true, acknowledgedImpact: 'Near-duplicate of "Brand Management", the owner-picked survivor of the pair. Members holding this row stop seeing the chip until they re-pick the surviving skill; the audit metadata records how many were holding it.' },

  // Change 39 (owner-approved 2026-07-03): the change that started the whole governance effort. The
  // generic marketing skill under the Food & Agriculture occupation funneled every holder into that
  // sector in the Workforce match (its job_title_id was the skill's only parent). Marketing now
  // lives under Professional & Business Services > Marketing Specialists; the sole known holder
  // ("00") re-picked their skills there before this change was appended.
  { id: 39, op: 'deactivateSkill', sector: 'Food & Agriculture', occupation: 'Agribusiness Managers', skill: 'Marketing and market analysis', occupationExisting: true, skillExisting: true, acknowledgedImpact: 'Generic marketing skill parented under a Food & Agriculture occupation pulled every holder into that sector in the Workforce match. The marketing skillset now lives under Marketing Specialists (Professional & Business Services), and the sole known holder re-picked their skills there before this op was appended; the audit metadata records the live holder count at apply time.' },

  // Changes 40-42 (owner-approved 2026-07-04): give the finance skillset a finance home. The two
  // financial skills existed only under Agribusiness Managers (Food & Agriculture), which confined
  // purely finance-skilled members to agriculture. With name-based skill matching in Workforce,
  // listing the same skill names under a finance occupation matches every holder there too — no
  // reparent and no member migration needed.
  { id: 40, op: 'addOccupation', sector: 'Professional & Business Services', occupation: 'Financial Analysts / Accountants' },
  { id: 41, op: 'addSkill', sector: 'Professional & Business Services', occupation: 'Financial Analysts / Accountants', skill: 'Financial planning and budgeting' },
  { id: 42, op: 'addSkill', sector: 'Professional & Business Services', occupation: 'Financial Analysts / Accountants', skill: 'Financial modeling and cashflow management' },

  // Changes 43-48 (owner-approved 2026-07-15): a taxonomy home for what invited members are already
  // doing on Quora — arguing for humanity and justice, and helping others survive. New occupation
  // "Advocates / Awareness Raisers" under Creative & Media, holding Advocacy (the baseline skill stamped
  // on temporary invite/bare profiles — Directory and Skills Hunt each require at least one skill),
  // Writing, Awareness raising, Storytelling, and Peer support. Additive; members swap the baseline once
  // they claim. Applies on the next owner run of the seed-skills-taxonomy apply workflow.
  { id: 43, op: 'addOccupation', sector: 'Creative & Media', occupation: 'Advocates / Awareness Raisers' },
  { id: 44, op: 'addSkill', sector: 'Creative & Media', occupation: 'Advocates / Awareness Raisers', skill: 'Advocacy' },
  { id: 45, op: 'addSkill', sector: 'Creative & Media', occupation: 'Advocates / Awareness Raisers', skill: 'Writing' },
  { id: 46, op: 'addSkill', sector: 'Creative & Media', occupation: 'Advocates / Awareness Raisers', skill: 'Awareness raising' },
  { id: 47, op: 'addSkill', sector: 'Creative & Media', occupation: 'Advocates / Awareness Raisers', skill: 'Storytelling' },
  { id: 48, op: 'addSkill', sector: 'Creative & Media', occupation: 'Advocates / Awareness Raisers', skill: 'Peer support' },

  // Change 49 (owner-approved 2026-07-16): promote skill proposal #1550 — the free-text skill "Chef"
  // from a SkillsHunt scout (submission 5ead88c9-54dc-4914-a98e-a1bba27a2a3b). Added under the
  // pre-existing "Chefs / Cooks" occupation in Tourism & Hospitality (the issue's AI-suggested placement,
  // confirmed). proposalNormalizedSkills marks the proposal row 'promoted' and attaches the skill to the
  // proposing member on apply.
  { id: 49, op: 'addSkill', sector: 'Tourism & Hospitality', occupation: 'Chefs / Cooks', skill: 'Chef', occupationExisting: true, proposalNormalizedSkills: ['chef'] },

  // Changes 50-51 (owner-approved 2026-07-17): two design/art skills the taxonomy was missing.
  // "Web and responsive design" under the pre-existing "Graphic / Visual Designers" occupation
  // (kept out of the design-heavy UX/UI Designers occupation by owner choice); "Illustration and
  // concept art" under the pre-existing "Artists / Illustrators" occupation. Both additive; a member
  // can pick them directly. Applies on the next owner run of the seed-skills-taxonomy apply workflow.
  { id: 50, op: 'addSkill', sector: 'Creative & Media', occupation: 'Graphic / Visual Designers', skill: 'Web and responsive design', occupationExisting: true },
  { id: 51, op: 'addSkill', sector: 'Creative & Media', occupation: 'Artists / Illustrators', skill: 'Illustration and concept art', occupationExisting: true },

  // Changes 52-57 (owner-approved 2026-07-17): a "Web Developers" job title the taxonomy was missing.
  // A live-DB check found no occupation containing "web" — the nearest were "Software Engineers /
  // Developers" (R&D & High-Tech) and "Software Developers" (Telecommunications & IT), neither of them
  // a web-development home. New occupation "Web Developers" under R&D & High-Tech (owner's sector pick —
  // it clusters the web-building trades already there, UX/UI Designers and Software Engineers /
  // Developers), seeded with five starter skills so the occupation is not inert (Workforce matches
  // holders by skill name; a skill-less occupation matches nobody and shows empty in the browser).
  // "Web and responsive design" repeats the name added under Graphic / Visual Designers in change 50 —
  // deliberate: the same skill name may live under several occupations and each listing extends where
  // its holders are matched. Op 52 creates the occupation; ops 53-57 add skills to it in the same apply
  // transaction, so no occupationExisting flag is needed. Applies on the next owner run of the
  // seed-skills-taxonomy apply workflow.
  { id: 52, op: 'addOccupation', sector: 'R&D & High-Tech', occupation: 'Web Developers' },
  { id: 53, op: 'addSkill', sector: 'R&D & High-Tech', occupation: 'Web Developers', skill: 'Front-end development' },
  { id: 54, op: 'addSkill', sector: 'R&D & High-Tech', occupation: 'Web Developers', skill: 'Back-end development' },
  { id: 55, op: 'addSkill', sector: 'R&D & High-Tech', occupation: 'Web Developers', skill: 'Full-stack development' },
  { id: 56, op: 'addSkill', sector: 'R&D & High-Tech', occupation: 'Web Developers', skill: 'Web and responsive design' },
  { id: 57, op: 'addSkill', sector: 'R&D & High-Tech', occupation: 'Web Developers', skill: 'JavaScript / TypeScript' },
];

// ---------------------------------------------------------------------------
// Static validation. Pure — no database. Replays the list against an in-memory
// registry and returns { valid, errors }. Every error names the offending change id.
// ---------------------------------------------------------------------------

function key(...parts) {
  return parts.map((part) => normalizeTaxonomyName(String(part ?? '')).toLowerCase()).join('|');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && normalizeTaxonomyName(value).length > 0;
}

export function validateTaxonomyChanges(ops = TAXONOMY_CHANGES) {
  const errors = [];
  const fail = (id, message) => errors.push(`change ${id}: ${message}`);

  if (!Array.isArray(ops)) {
    return { valid: false, errors: ['TAXONOMY_CHANGES is not an array.'] };
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
        fail(id, `${label} occupation "${occupation}" (${sector}) is not created by an earlier change; add an addOccupation change first or set the existing flag if it is a pre-existing live row.`);
        return null;
      }
    }
    const occ = occupations.get(occKey);
    if (!occ.active) {
      fail(id, `${label} occupation "${occupation}" (${sector}) was deactivated by an earlier change.`);
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

    if (!TAXONOMY_CHANGE_TYPES.includes(entry.op)) {
      fail(id, `unknown change type "${entry.op}".`);
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
          fail(id, `occupation "${entry.occupation}" (${entry.sector}) is already created by an earlier change.`);
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

      case 'consolidateSkill': {
        if (!isNonEmptyString(entry.skill) || !isNonEmptyString(entry.fromSector) || !isNonEmptyString(entry.fromOccupation) || !isNonEmptyString(entry.toSector) || !isNonEmptyString(entry.toOccupation)) {
          fail(id, 'consolidateSkill requires non-empty skill, fromSector, fromOccupation, toSector, and toOccupation.');
          return;
        }
        requireOccupation(id, entry.fromSector, entry.fromOccupation, entry.fromOccupationExisting, 'source');
        const toKey = requireOccupation(id, entry.toSector, entry.toOccupation, entry.toOccupationExisting, 'target');
        if (!toKey) return;
        const fromSkillKey = key(entry.fromSector, entry.fromOccupation, entry.skill);
        const toSkillKey = key(entry.toSector, entry.toOccupation, entry.skill);
        // Unlike reparentSkill, a same-named row at the target is allowed: it absorbs the source.
        const state = skills.get(fromSkillKey) ?? { active: true };
        if (!state.active) {
          fail(id, `cannot consolidate deactivated skill "${entry.skill}"; reactivate it first.`);
          return;
        }
        skills.delete(fromSkillKey);
        skills.set(toSkillKey, { active: true });
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
          fail(id, `skill "${entry.skill}" is not created by an earlier change; set skillExisting: true if it is a pre-existing live row.`);
          return;
        }
        const state = skills.get(skillKey) ?? { active: true };
        if (!state.active) {
          fail(id, `skill "${entry.skill}" is already deactivated by an earlier change.`);
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
          fail(id, `occupation "${entry.occupation}" (${entry.sector}) is not created by an earlier change; set occupationExisting: true if it is a pre-existing live row.`);
          return;
        }
        const state = occupations.get(occKey) ?? { active: true };
        if (!state.active) {
          fail(id, `occupation "${entry.occupation}" (${entry.sector}) is already deactivated by an earlier change.`);
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
          fail(id, `skill "${entry.skill}" is not known to earlier changes; set skillExisting: true if it is a pre-existing live row.`);
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
          fail(id, `occupation "${entry.occupation}" (${entry.sector}) is not known to earlier changes; set occupationExisting: true if it is a pre-existing live row.`);
          return;
        }
        const state = occupations.get(occKey) ?? { active: false };
        state.active = true;
        occupations.set(occKey, state);
        return;
      }

      default:
        fail(id, `unhandled change type "${entry.op}".`);
    }
  });

  return { valid: errors.length === 0, errors };
}
