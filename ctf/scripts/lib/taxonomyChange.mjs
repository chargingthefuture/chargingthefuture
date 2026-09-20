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
//   { id, op: 'setOccupationWorkforceShare', sector, occupation, share, rationale, occupationExisting?: true }
//     -- the occupation's demand weight RELATIVE to the other occupations in its sector. 3 against 1
//        means three times as many people. Not a percentage, so one occupation can be weighted
//        without restating its siblings. An unweighted occupation counts as 1, so a sector nobody has
//        weighted splits evenly exactly as it always did, and a part-weighted sector still behaves.
//        `share: 0` means the model expects nobody in the occupation and is different from never
//        having set one. Re-weighting is a new entry with the new value; the last entry wins.
//
// 'acknowledgedImpact' is a mandatory human-written note on every deactivation stating the reviewed
// blast radius (how many member profiles reference the target, and why deactivating is right). The
// apply engine re-checks the live reference counts and aborts if the impact was never acknowledged.
//
// 'rationale' is the same idea for a weight: a mandatory human-written note saying where the number
// came from. A demand weight is an assertion about how many people a settlement needs in a trade,
// and an unsourced one is worse than the even split it replaces, because it looks researched. The
// note is what a reviewer checks; requiring it is what stops a weight list from being filled in
// wholesale by anybody, agent included, who cannot say where the numbers came from.

import { normalizeTaxonomyName } from './taxonomyNames.mjs';

// Names the taxonomy will never carry, whatever change proposes them. Checked against every name a
// change CREATES or RENAMES TO (skills and occupations alike), so a later pass cannot reintroduce one
// by copying what a nearby entry does - which is how a bad name normally gets in, since an addSkill
// line in review looks like every other addSkill line.
//
// "Community policing" / "community police" (owner directive, 2026-09-20). The term is what vigilante
// and trafficking networks call themselves; it does not name a policing function this product should
// let anyone claim. It is banned as a NAME, not as a subject: "Community outreach" (live under Social
// Workers), "Community-Health Workers" (a live occupation) and "Community outreach" anywhere else are
// untouched, because the pattern matches only the word community immediately followed by polic-.
//
// This list is deliberately tiny and every entry needs a recorded reason. It is a place for names that
// are harmful to carry, not a style guide - a merely clumsy name is a review comment, not a ban.
export const PROHIBITED_NAME_PATTERNS = [
  {
    pattern: /\bcommunit(?:y|ies)[\s\-]*polic/i,
    reason:
      'names what vigilante and trafficking networks call themselves rather than a policing function (owner directive, 2026-09-20)',
  },
];

// The offending entry, or null when the name is allowed.
export function findProhibitedName(value) {
  const name = normalizeTaxonomyName(String(value ?? ''));
  if (name.length === 0) return null;
  return PROHIBITED_NAME_PATTERNS.find((entry) => entry.pattern.test(name)) ?? null;
}

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
  'setOccupationWorkforceShare',
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

  // Changes 58-67 (issue #2344, owner request 2026-08-28): childcare, plus the teaching gaps that
  // survived a check against the live taxonomy. A full read of the live occupation list (149
  // occupations across all 20 sectors) answered both questions the issue said only the live data
  // could. Education is a live sector and already carries seven occupations - Primary School
  // Teachers, Secondary School Teachers, Early-Childhood Educators, School Administrators,
  // Vocational Trainers, University Faculty, Education Support Staff - each holding three skills and
  // each named in the plural, which is the convention these entries follow.
  //
  // Teaching: five of the seven skills the issue proposed are already live under a different name,
  // so they are deliberately NOT added here. "Early years teaching" is the Early-Childhood Educators
  // occupation itself; "primary teaching" is its "Curriculum delivery and lesson planning";
  // "secondary subject teaching" is "Subject-matter instruction"; "special educational needs" is
  // "Special education support"; "early childhood development" is "Developmental activity planning".
  // Adding them again would split holders of one thing across two names - the harm changes 26-34 had
  // to undo. Three teaching items were genuinely absent: tutoring, homeschooling, adult education.
  //
  // Childcare: no occupation in any sector is a childcare home, so the issue's premise held. The
  // near misses were each checked and rejected - Early-Childhood Educators is the trained-educator
  // role (its third skill is "Parent communication"), Health carries clinical roles only (Nurses,
  // Midwives, Social Workers, Therapists), and the closest Retail & Services row names its own
  // trades, "Personal Services (hairdressers, repair)". Childcare therefore gets its own occupation
  // under Education, sitting next to Early-Childhood Educators.
  //
  // "Tutors" is a second new occupation rather than a skill hung off an existing one: tutoring is
  // the one teaching role with no live home, and Education Support Staff is school staff
  // (Administrative assistance, Librarianship), not a private tutor.
  //
  // Both new occupations are seeded with skills in the same apply run, because Workforce matches
  // holders by skill name and an occupation with no skills matches nobody and shows empty in the
  // browser. Ops 58 and 64 create the occupations, so the addSkill ops beneath them need no
  // occupationExisting flag; op 67 targets the pre-existing Vocational Trainers occupation and
  // carries it. Applies on the next owner run of the seed-skills-taxonomy apply workflow.
  { id: 58, op: 'addOccupation', sector: 'Education', occupation: 'Childcare Workers' },
  { id: 59, op: 'addSkill', sector: 'Education', occupation: 'Childcare Workers', skill: 'Childcare and babysitting' },
  { id: 60, op: 'addSkill', sector: 'Education', occupation: 'Childcare Workers', skill: 'Infant and toddler care' },
  { id: 61, op: 'addSkill', sector: 'Education', occupation: 'Childcare Workers', skill: 'After-school care' },
  { id: 62, op: 'addSkill', sector: 'Education', occupation: 'Childcare Workers', skill: 'Special needs care' },
  { id: 63, op: 'addSkill', sector: 'Education', occupation: 'Childcare Workers', skill: 'Child first aid and CPR' },
  { id: 64, op: 'addOccupation', sector: 'Education', occupation: 'Tutors' },
  { id: 65, op: 'addSkill', sector: 'Education', occupation: 'Tutors', skill: 'Tutoring' },
  { id: 66, op: 'addSkill', sector: 'Education', occupation: 'Tutors', skill: 'Homeschooling and curriculum planning' },
  { id: 67, op: 'addSkill', sector: 'Education', occupation: 'Vocational Trainers', skill: 'Adult education and training', occupationExisting: true },

  // Changes 68-78 (owner-approved 2026-08-29): the singular/plural duplicate incident, found again.
  // A read of the live occupation list turned up "Photographer" and "Photographers / Videographers"
  // both active under Creative & Media - the same shape as the "Marketing Specialist" /
  // "Marketing Specialists" pair that changes 1 and 26-34 had to unwind. The harm is not cosmetic:
  // Workforce and the Directory match holders through the occupation a skill hangs from, so a member
  // listed under one of the pair is invisible to somebody browsing the other, and neither row shows
  // the community's real photography capacity.
  //
  // The plural row is the seeded one and keeps its three original skills (Asset management and
  // metadata tagging, Post-production and color grading, Shooting and lighting techniques). The
  // singular row carries eight, every one of them added later. Ops 68-75 consolidate those eight
  // into the plural occupation; op 76 deactivates the emptied duplicate. consolidateSkill is the
  // merge-aware move, so a name already present at the target absorbs the moving copy instead of
  // colliding - and no name in this set collides today, so all eight reparent. Member profile links
  // point at the skill row id, which consolidateSkill does not change, so nobody loses a skill.
  //
  // Two near-duplicate PAIRS survive this merge and are deliberately left alone: "Lighting
  // techniques" against "Shooting and lighting techniques", and "Photo editing and post-processing"
  // against "Post-production and color grading". Thinning a pair means deactivating one label, and a
  // member holding the deactivated row stops seeing that chip until they re-pick - so which one
  // survives is the owner's pick, recorded as its own change the way ops 35-38 recorded the
  // marketing pairs. Merging first and thinning second is the same order that worked there.
  //
  // Ops 77-78 fix two singular occupation names with no duplicate behind them, so a rename is the
  // whole fix: "Apparel / Fashion Designer" against the plural Creative & Media convention
  // (Graphic / Visual Designers, Artists / Illustrators, Photographers / Videographers), and
  // "Machinist" against Manufacturing & Industry's (Production Workers, Quality Inspectors, Process
  // Operators). Renaming an occupation moves no rows and breaks no member link - the row keeps its
  // id. Left as they are: names that read as singular but are collective ("Education Support Staff",
  // "Forensic Staff", "Hotel Staff (front desk, housekeeping)") and parenthetical ones that are
  // already plural in substance. Applies on the next owner run of the seed-skills-taxonomy apply
  // workflow.
  { id: 68, op: 'consolidateSkill', skill: 'Photography', fromSector: 'Creative & Media', fromOccupation: 'Photographer', fromOccupationExisting: true, toSector: 'Creative & Media', toOccupation: 'Photographers / Videographers', toOccupationExisting: true },
  { id: 69, op: 'consolidateSkill', skill: 'Camera operation and settings', fromSector: 'Creative & Media', fromOccupation: 'Photographer', fromOccupationExisting: true, toSector: 'Creative & Media', toOccupation: 'Photographers / Videographers', toOccupationExisting: true },
  { id: 70, op: 'consolidateSkill', skill: 'Composition and framing', fromSector: 'Creative & Media', fromOccupation: 'Photographer', fromOccupationExisting: true, toSector: 'Creative & Media', toOccupation: 'Photographers / Videographers', toOccupationExisting: true },
  { id: 71, op: 'consolidateSkill', skill: 'Lighting techniques', fromSector: 'Creative & Media', fromOccupation: 'Photographer', fromOccupationExisting: true, toSector: 'Creative & Media', toOccupation: 'Photographers / Videographers', toOccupationExisting: true },
  { id: 72, op: 'consolidateSkill', skill: 'Photo editing and post-processing', fromSector: 'Creative & Media', fromOccupation: 'Photographer', fromOccupationExisting: true, toSector: 'Creative & Media', toOccupation: 'Photographers / Videographers', toOccupationExisting: true },
  { id: 73, op: 'consolidateSkill', skill: 'Portrait photography', fromSector: 'Creative & Media', fromOccupation: 'Photographer', fromOccupationExisting: true, toSector: 'Creative & Media', toOccupation: 'Photographers / Videographers', toOccupationExisting: true },
  { id: 74, op: 'consolidateSkill', skill: 'Event photography', fromSector: 'Creative & Media', fromOccupation: 'Photographer', fromOccupationExisting: true, toSector: 'Creative & Media', toOccupation: 'Photographers / Videographers', toOccupationExisting: true },
  { id: 75, op: 'consolidateSkill', skill: 'Product photography', fromSector: 'Creative & Media', fromOccupation: 'Photographer', fromOccupationExisting: true, toSector: 'Creative & Media', toOccupation: 'Photographers / Videographers', toOccupationExisting: true },
  { id: 76, op: 'deactivateOccupation', sector: 'Creative & Media', occupation: 'Photographer', occupationExisting: true, acknowledgedImpact: 'Duplicate of the pre-existing "Photographers / Videographers" occupation; all 8 of its skills are consolidated there by ops 68-75, so no active skill row remains under it and member profile links are untouched (consolidateSkill moves the row, not the id). The apply engine refuses this op if any active skill remains, and the audit row records the live reference count at apply time. Reversible via reactivateOccupation.' },
  { id: 77, op: 'renameOccupation', sector: 'Creative & Media', from: 'Apparel / Fashion Designer', to: 'Apparel / Fashion Designers' },
  { id: 78, op: 'renameOccupation', sector: 'Manufacturing & Industry', from: 'Machinist', to: 'Machinists' },

  // Change 79 (owner-approved 2026-08-29): thin the one real near-duplicate the 68-76 merge leaves
  // behind. "Lighting techniques" (moved in by op 71) and "Shooting and lighting techniques" (the
  // seeded row) are the same claim, and the merged occupation already carries "Camera operation and
  // settings" and "Composition and framing" for the shooting half - so the compound label adds
  // nothing the plainer one does not, and a member reading a list with both in it cannot tell which
  // to pick. "Lighting techniques" survives. Same merge-then-thin order as ops 26-34 then 35-38.
  //
  // The OTHER pair the merge leaves - "Photo editing and post-processing" against "Post-production
  // and color grading" - is deliberately NOT thinned, and is not a duplicate on a second look: this
  // occupation is "Photographers / Videographers", and those two labels are the photo side and the
  // video side of its post-production work. Deactivating either would leave half the occupation with
  // no way to say what it does. They stay as two skills on purpose.
  { id: 79, op: 'deactivateSkill', sector: 'Creative & Media', occupation: 'Photographers / Videographers', occupationExisting: true, skill: 'Shooting and lighting techniques', skillExisting: true, acknowledgedImpact: 'Near-duplicate of "Lighting techniques", which survives as the plainer label; the merged occupation already carries "Camera operation and settings" and "Composition and framing" for the shooting half, so no claim is lost. Members holding this row stop seeing the chip until they re-pick the surviving skill, and the audit metadata records how many were holding it at apply time. Reversible via reactivateSkill.' },

  // Changes 80-92 (owner-approved 2026-09-20): "Medical Assistants" joins Health, and Social Workers
  // gains "Domestic violence advocacy". The request came from a conversation with a member whose
  // working life is a medical assistant's, and a read of the live Health sector settled where it
  // belongs: thirteen occupations (Community-Health Workers, EMS / Paramedics, General
  // Practitioners, Laboratory Technicians, Mental Health Counselors, Midwives, Nurses, Pharmacists,
  // Psychologists, Radiographers, Social Workers, "Specialists (e.g., cardiology, pediatrics)",
  // Therapists) and not one of them is a medical assistant. Nurses is the nearest row and is the
  // wrong one - the member drew the distinction themselves, and a medical assistant working a
  // psychiatry clinic is neither a nurse nor a counselor. So it gets its own occupation, the way
  // Childcare Workers and Tutors did under Education in changes 58-67, rather than being hung off
  // a role it is not.
  //
  // Op 80 creates the occupation, so ops 81-91 carry no occupationExisting flag. "Medical
  // Assistants" was checked against all thirteen live Health occupations under the plural-twin rule
  // (this is the first change at or past id 80, where the guard starts applying) and shares a role
  // token with none of them. The occupation is seeded with its skills in the same apply run for the
  // reason changes 58-67 recorded: Workforce matches holders by skill name, so an occupation with no
  // skills matches nobody and shows empty in the browser.
  //
  // Two of the eleven reuse a live label EXACTLY rather than inventing a synonym: "Patient
  // assessment and monitoring" (live under Nurses) and "Patient communication" (live under General
  // Practitioners). Duplicating a label across occupations is the sector's established shape, not an
  // oversight - "Crisis intervention" already has four rows (Mental Health Counselors,
  // Psychologists, Social Workers, Therapists), "Trauma-informed care" two, "First Aid & CPR" two -
  // and it is the right shape here: one name keeps keyword search and name matching joined, while
  // the separate row is what makes the skill show when somebody browses THIS occupation. What the
  // second row does not do is fix attribution, and it is worth being exact about that: Workforce
  // ignores the stored row's parent entirely (its skill arm re-expands by name across every
  // same-named active row before counting), and the Directory picker collapses same-named rows into
  // one chip and stores an arbitrary representative id, so the parent a member ends up attached to
  // was never a choice they made. Within one sector that costs nothing, which is the case here -
  // both reused labels stay inside Health. Across sectors it would not, because the Directory
  // sector filter does read the stored row's parent. Writing "Patient assessment" beside
  // the live "Patient assessment and monitoring" is the failure to avoid, because a second NAME for
  // one claim splits its holders (changes 26-34 and 79).
  //
  // Op 90 reuses "Client advocacy", the label Social Workers already carries, rather than adding
  // "Patient advocacy" as a second name for the same act. This was the set's one judgment call and it
  // was settled by the live holder counts: two members already hold "Client advocacy". Because
  // Workforce joins holders by NAME, a new "Patient advocacy" label would never join those two, so
  // the community's advocacy capacity would read as two separate smaller pools - the exact split
  // changes 26-34 and 79 had to undo. Occupation is not what joins holders; the name is, which is why
  // "it sits under a different occupation" does not make a second name safe. The cost of reusing the
  // social-work word is that a medical assistant reads "client" where they would say "patient"; the
  // cost of the alternative is a permanently split count. If the owner prefers the patient-facing
  // word, the correct fix is NOT this op - it is a renameSkill of the live row, which keeps the row
  // id (so the two holders keep their skill) and appends the old label to its aliases so the old word
  // stays findable.
  //
  // Op 92 targets the pre-existing Social Workers occupation (occupationExisting: true). Domestic
  // violence advocacy has no live label, and that was checked rather than assumed: a scan of every
  // active skill in all 20 sectors for advoca|victim|domestic|abuse|survivor|safeguard|shelter
  // returned seven rows and not one of them is this claim - "Advocacy" (Creative & Media > Advocates
  // / Awareness Raisers) is campaigning and awareness work, "Legal advocacy and advice" (Lawyers) is
  // legal representation, "Substance abuse counseling" and "Substance abuse support" matched only on
  // the word abuse, "Shelter site selection and layout" (Emergency & Reserve Roles) is disaster-relief
  // logistics, "Domestic and commercial systems" (Water & Sanitation > Plumbers) is plumbing, and
  // "Client advocacy" is the general-purpose label op 90 reuses. Health's own "Crisis intervention",
  // "Family assessment and intervention" and "Trauma-informed care" are adjacent and none says it
  // either. It sits under Social Workers rather than Medical Assistants because it is advocacy work in
  // its own right, done by people who are not medical assistants. The same scan confirmed
  // "Client advocacy" is live exactly once, so op 90 creates its second row and splits no holders.
  //
  // Deliberately NOT proposed, from the same conversation: "single mom", which is a life
  // circumstance and already recorded as a title, not a skill the taxonomy can match a settlement's
  // demand against; and "interacts with people easily", which is too general to match on and is
  // carried concretely by op 91. No proposalNormalizedSkills is set - the request came from the
  // owner directly, not from the skill-proposal intake queue, so there is no member proposal row for
  // the apply run to mark promoted. Applies on the next owner run of the seed-skills-taxonomy apply
  // workflow.
  { id: 80, op: 'addOccupation', sector: 'Health', occupation: 'Medical Assistants' },
  { id: 81, op: 'addSkill', sector: 'Health', occupation: 'Medical Assistants', skill: 'Phlebotomy (blood draws)' },
  { id: 82, op: 'addSkill', sector: 'Health', occupation: 'Medical Assistants', skill: 'Injections (intramuscular and subcutaneous)' },
  { id: 83, op: 'addSkill', sector: 'Health', occupation: 'Medical Assistants', skill: 'Vital signs measurement' },
  { id: 84, op: 'addSkill', sector: 'Health', occupation: 'Medical Assistants', skill: 'Patient intake and registration' },
  { id: 85, op: 'addSkill', sector: 'Health', occupation: 'Medical Assistants', skill: 'Patient assessment and monitoring' },
  { id: 86, op: 'addSkill', sector: 'Health', occupation: 'Medical Assistants', skill: 'EKG (electrocardiogram) testing' },
  { id: 87, op: 'addSkill', sector: 'Health', occupation: 'Medical Assistants', skill: 'Splinting, casting and orthopedic wraps' },
  { id: 88, op: 'addSkill', sector: 'Health', occupation: 'Medical Assistants', skill: 'Urgent care clinic support' },
  { id: 89, op: 'addSkill', sector: 'Health', occupation: 'Medical Assistants', skill: 'Psychiatric clinic support' },
  { id: 90, op: 'addSkill', sector: 'Health', occupation: 'Medical Assistants', skill: 'Client advocacy' },
  { id: 91, op: 'addSkill', sector: 'Health', occupation: 'Medical Assistants', skill: 'Patient communication' },
  { id: 92, op: 'addSkill', sector: 'Health', occupation: 'Social Workers', occupationExisting: true, skill: 'Domestic violence advocacy' },

  // Changes 93-99 (owner-approved 2026-09-20): fill out Public Safety & Justice > Police Officers.
  // A read of the live sector for the domestic-violence-advocacy placement turned up the gap: its six
  // occupations are Corrections Officers, Firefighters, Forensic Staff, Judges, Lawyers and Police
  // Officers, and every one of them carries two or three skills except Police Officers, which carries
  // exactly one - "Evidence handling and reporting". So a member whose policing work is patrol,
  // investigation, custody or public order has nothing to pick, and the occupation shows almost empty
  // to anyone browsing it. Workforce matches holders by skill name, so a nearly skill-less occupation
  // also matches almost nobody and the community's policing capacity reads as near zero.
  //
  // SCOPE, and it is a hard line (owner directive, 2026-09-20): police are not social workers, and no
  // skill under this occupation may frame them as such. Deliberately NOT added, each considered and
  // rejected on that directive: community liaison, crisis intervention, de-escalation and
  // mental-health response, welfare checks, victim support. Several of those labels already live under
  // Health > Social Workers and Mental Health Counselors, which is where that work belongs and where a
  // member doing it should be found. The seven below are the operational craft of the job and nothing
  // else.
  //
  // "Community policing" is rejected on separate and stronger grounds and is now refused by the
  // validator rather than left to review (see PROHIBITED_NAME_PATTERNS at the top of this file): the
  // term is what vigilante and trafficking networks call themselves, so it is not a name this taxonomy
  // should let anyone claim in any sector, not merely one to keep off this occupation.
  //
  // All seven target the pre-existing Police Officers row, so each carries occupationExisting: true.
  // No new occupation, so the plural-twin guard has nothing to check here. None of the seven names
  // exists anywhere else in the live taxonomy as far as the sector reads available at authoring time
  // show; that matters beyond tidiness, because the Directory's sector filter resolves a member
  // through the stored row's parent while its picker de-duplicates search results by name across
  // sectors - so a name shared between two sectors can file a member under the wrong one (live today
  // for "Programming" and "Plumber"). Keeping these names unique to this sector keeps them out of
  // that. Applies on the next owner run of the seed-skills-taxonomy apply workflow.
  { id: 93, op: 'addSkill', sector: 'Public Safety & Justice', occupation: 'Police Officers', occupationExisting: true, skill: 'Patrol and incident response' },
  { id: 94, op: 'addSkill', sector: 'Public Safety & Justice', occupation: 'Police Officers', occupationExisting: true, skill: 'Criminal investigation' },
  { id: 95, op: 'addSkill', sector: 'Public Safety & Justice', occupation: 'Police Officers', occupationExisting: true, skill: 'Arrest and custody procedures' },
  { id: 96, op: 'addSkill', sector: 'Public Safety & Justice', occupation: 'Police Officers', occupationExisting: true, skill: 'Search and seizure procedures' },
  { id: 97, op: 'addSkill', sector: 'Public Safety & Justice', occupation: 'Police Officers', occupationExisting: true, skill: 'Traffic enforcement and collision investigation' },
  { id: 98, op: 'addSkill', sector: 'Public Safety & Justice', occupation: 'Police Officers', occupationExisting: true, skill: 'Public order and crowd management' },
  { id: 99, op: 'addSkill', sector: 'Public Safety & Justice', occupation: 'Police Officers', occupationExisting: true, skill: 'Interview and statement taking' },

  // Changes 100-111 (owner-approved 2026-09-20): swimming and physical education join Education.
  // Nobody in this community can currently say they teach a child to swim, or teach PE at all.
  //
  // A read settled both halves. Education holds nine occupations - Childcare Workers,
  // Early-Childhood Educators, Education Support Staff, Primary School Teachers, School
  // Administrators, Secondary School Teachers, Tutors, University Faculty, Vocational Trainers -
  // and not one of them is a physical or sports role; the nearest, Early-Childhood Educators'
  // "Health and safety for young children", is supervision, not instruction. A scan of every active
  // skill in all 20 sectors for swim|sport|coach|athlet|fitness|physical education|lifeguard|
  // recreation|gym|water safety returned exactly two rows, and both are false positives on the
  // letters "sport" inside "transport": "Safe transport and disposal procedures" (Environmental &
  // Waste Management) and "Triage and transport protocols" (Health). So none of the twelve names
  // below collides with anything live, in this sector or any other - which matters beyond tidiness,
  // because a skill name shared across two sectors files a member under an arbitrary one of them.
  //
  // Two occupations rather than one, because a gym teacher and a swimming teacher are different
  // jobs and the taxonomy is what tells a member which roles their skill reaches. Both are named in
  // the plural, matching every other Education row, and neither shares a role token with a live one,
  // so the plural-twin guard passes.
  //
  // "Swimming instruction" and "Water safety and lifeguarding" are deliberately listed under BOTH
  // occupations, the same way "Crisis intervention" sits under four Health occupations. That is the
  // point of the duplication here rather than an accident of it: somebody whose one nameable skill
  // is swimming picks it once and reaches two roles, not one.
  //
  // Nothing here is scoped to children (owner note): adults learn to swim too, and a name like
  // "Youth swimming instruction" would have quietly excluded half the people who could teach it.
  // Vocational Trainers' pre-existing "Adult education and training" already covers the adult-teaching
  // side for anyone who wants to claim it, so no age-specific skill is added on either end.
  //
  // "Adaptive and inclusive physical education" is on the list on purpose. A child who has been
  // through what the children this is for have been through may not arrive able to do ordinary PE,
  // and a teacher who can work with that is a different capability worth naming rather than folding
  // into the general one. Applies on the next owner run of the seed-skills-taxonomy apply workflow.
  { id: 100, op: 'addOccupation', sector: 'Education', occupation: 'Physical Education Teachers' },
  { id: 101, op: 'addSkill', sector: 'Education', occupation: 'Physical Education Teachers', skill: 'Physical education teaching' },
  { id: 102, op: 'addSkill', sector: 'Education', occupation: 'Physical Education Teachers', skill: 'Adaptive and inclusive physical education' },
  { id: 103, op: 'addSkill', sector: 'Education', occupation: 'Physical Education Teachers', skill: 'Sports safety and injury prevention' },
  { id: 104, op: 'addSkill', sector: 'Education', occupation: 'Physical Education Teachers', skill: 'Swimming instruction' },
  { id: 105, op: 'addSkill', sector: 'Education', occupation: 'Physical Education Teachers', skill: 'Water safety and lifeguarding' },
  { id: 106, op: 'addOccupation', sector: 'Education', occupation: 'Swimming Instructors / Sports Coaches' },
  { id: 107, op: 'addSkill', sector: 'Education', occupation: 'Swimming Instructors / Sports Coaches', skill: 'Swimming instruction' },
  { id: 108, op: 'addSkill', sector: 'Education', occupation: 'Swimming Instructors / Sports Coaches', skill: 'Water safety and lifeguarding' },
  { id: 109, op: 'addSkill', sector: 'Education', occupation: 'Swimming Instructors / Sports Coaches', skill: 'Stroke technique and race training' },
  { id: 110, op: 'addSkill', sector: 'Education', occupation: 'Swimming Instructors / Sports Coaches', skill: 'Sports coaching' },
  { id: 111, op: 'addSkill', sector: 'Education', occupation: 'Swimming Instructors / Sports Coaches', skill: 'Fitness and conditioning coaching' },
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

  // Every name a change creates or renames to passes the prohibited-name list. Returns true when the
  // name is refused, so each caller can stop before registering it.
  const refuseProhibitedName = (id, value, label) => {
    const hit = findProhibitedName(value);
    if (!hit) return false;
    fail(id, `${label} "${normalizeTaxonomyName(String(value ?? ''))}" is not an allowed name: it ${hit.reason}.`);
    return true;
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
        if (refuseProhibitedName(id, entry.occupation, 'occupation')) return;
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
        if (refuseProhibitedName(id, entry.skill, 'skill')) return;
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
        if (refuseProhibitedName(id, entry.to, 'rename target occupation')) return;
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
        if (refuseProhibitedName(id, entry.to, 'rename target skill')) return;
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

      case 'setOccupationWorkforceShare': {
        if (!isNonEmptyString(entry.sector) || !isNonEmptyString(entry.occupation)) {
          fail(id, 'setOccupationWorkforceShare requires non-empty sector and occupation.');
          return;
        }
        if (typeof entry.share !== 'number' || !Number.isFinite(entry.share) || entry.share < 0) {
          fail(id, 'setOccupationWorkforceShare requires a finite share of 0 or more (a weight relative to the sector\'s other occupations, not a percentage).');
          return;
        }
        if (!isNonEmptyString(entry.rationale)) {
          fail(id, 'setOccupationWorkforceShare requires a rationale saying where the number came from — an unsourced weight is worse than the even split it replaces.');
          return;
        }
        if (!requireOccupation(id, entry.sector, entry.occupation, entry.occupationExisting, 'target')) return;
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
